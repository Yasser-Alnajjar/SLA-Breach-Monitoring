import type { Session } from "next-auth";
import type { PrismaClient } from "@sla/db";
import type {
  ConciergeIntegrationOption,
  ConciergeOrganizationOption,
  ConciergeSourceProvider,
} from "./types/concierge-export";

/**
 * Who may export what for the Concierge export pages (Jira and Zendesk).
 *
 * Tenancy is the app's usual one: a session's `user.organizationId` (set at
 * sign-in, see `@/lib/auth`) is the one organization it can act on, and an
 * integration belongs to an organization through `Integration.organizationId`.
 * The organization query also requires the user row to still belong to it,
 * so a token minted before a user row changed can't reach the old tenant.
 * Everything here is re-run on every request; nothing the client sends is
 * trusted beyond "which of your own rows did you mean".
 */

export async function listAuthorizedOrganizations(
  prisma: PrismaClient,
  session: Session,
): Promise<ConciergeOrganizationOption[]> {
  return prisma.organization.findMany({
    where: {
      id: session.user.organizationId,
      users: { some: { id: session.user.id } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Only fields safe to send to the browser; `credentials` is read here for the label and status, then dropped. */
export async function listSourceIntegrations(
  prisma: PrismaClient,
  organizationId: string,
  provider: ConciergeSourceProvider,
): Promise<ConciergeIntegrationOption[]> {
  const rows = await prisma.integration.findMany({
    where: { organizationId, provider },
    select: { id: true, organizationId: true, provider: true, status: true, credentials: true, connectedAt: true },
    orderBy: { connectedAt: "asc" },
  });
  return rows.map((row) => toIntegrationOption(row));
}

interface IntegrationRow {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  credentials: unknown;
}

function toIntegrationOption(row: IntegrationRow): ConciergeIntegrationOption {
  const credentials = row.credentials as { reauthRequired?: boolean; siteUrl?: string; subdomain?: string } | null;
  const unavailableReason =
    credentials === null || row.status === "disconnected"
      ? "Disconnected"
      : credentials.reauthRequired === true || row.status === "reauth_required"
        ? "Needs to be reconnected"
        : row.status === "permission_denied"
          ? `${row.provider === "zendesk" ? "Zendesk" : "Jira"} denied access`
          : null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.provider === "zendesk" ? zendeskIntegrationName(credentials?.subdomain) : jiraIntegrationName(credentials?.siteUrl),
    exportable: unavailableReason === null,
    unavailableReason,
  };
}

export function jiraIntegrationName(siteUrl: string | undefined): string {
  if (!siteUrl) return "Jira Cloud";
  try {
    return `Jira Cloud (${new URL(siteUrl).host})`;
  } catch {
    return "Jira Cloud";
  }
}

export function zendeskIntegrationName(subdomain: string | undefined): string {
  return subdomain ? `Zendesk (${subdomain}.zendesk.com)` : "Zendesk";
}

export type SourceExportAuthorization =
  | { ok: true; organizationId: string; integrationId: string; credentials: unknown }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

/**
 * The server-side gate for an export: the organization must be one the
 * session may access, and the integration must be an integration of that
 * provider in that same organization. Cross-organization ids get the same
 * 404 as ids that don't exist, so the response doesn't confirm another
 * tenant's rows.
 */
export async function authorizeSourceExport(
  prisma: PrismaClient,
  session: Session,
  provider: ConciergeSourceProvider,
  input: { organizationId?: unknown; integrationId?: unknown },
): Promise<SourceExportAuthorization> {
  const { organizationId, integrationId } = input;
  if (typeof organizationId !== "string" || !organizationId || typeof integrationId !== "string" || !integrationId) {
    return { ok: false, status: 400, error: `organizationId and ${provider}IntegrationId are required` };
  }

  const organizations = await listAuthorizedOrganizations(prisma, session);
  if (!organizations.some((organization) => organization.id === organizationId)) {
    return { ok: false, status: 403, error: "You don't have access to this organization" };
  }

  const label = provider === "zendesk" ? "Zendesk" : "Jira";
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, provider },
    select: { id: true, organizationId: true, provider: true, status: true, credentials: true },
  });
  if (!integration) {
    return { ok: false, status: 404, error: `${label} integration not found for this organization` };
  }

  const option = toIntegrationOption(integration);
  if (!option.exportable) {
    return { ok: false, status: 409, error: `This ${label} integration can't be exported: ${option.unavailableReason}` };
  }

  return { ok: true, organizationId, integrationId: integration.id, credentials: integration.credentials };
}
