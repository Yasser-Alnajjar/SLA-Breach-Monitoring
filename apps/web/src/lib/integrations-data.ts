import type { PrismaClient } from "@sla/db";
import { getIntegrationConfigStatus } from "@sla/db";
import type { ZendeskCredentials } from "@sla/zendesk";
import { getSlaPolicies } from "./sla-policies-data";
import type {
  IntegrationConnectionView,
  IntegrationsPageData,
} from "./types/integrations";

type IntegrationRow = {
  connectedAt: Date;
  disconnectedAt: Date | null;
  credentials: unknown;
} | null;

/** Never return `credentials`/the row itself — only these display-only scalars. */
function toConnectionView(
  integration: IntegrationRow,
): IntegrationConnectionView {
  if (!integration) {
    return {
      connected: false,
      reauthRequired: false,
      connectedAt: null,
      disconnectedAt: null,
    };
  }
  const credentials = integration.credentials as {
    reauthRequired?: boolean;
  } | null;
  return {
    connected: credentials !== null,
    reauthRequired: credentials?.reauthRequired === true,
    connectedAt: integration.connectedAt,
    disconnectedAt: integration.disconnectedAt,
  };
}

/** Assembles the integrations settings page's read model (roadmap step 17). */
export async function getIntegrationsData(
  prisma: PrismaClient,
  organizationId: string,
): Promise<IntegrationsPageData> {
  const [
    zendeskIntegration,
    jiraIntegration,
    linearIntegration,
    slackIntegration,
    organization,
    slaPolicies,
    zendeskConfig,
    linearConfig,
    jiraConfig,
    slackConfig,
  ] = await Promise.all([
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "zendesk" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "jira" } },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "linear" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.slackIntegration.findUnique({
      where: { organizationId },
      select: {
        teamName: true,
        channelId: true,
        channelName: true,
        installedAt: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { engineeringLegTargetMinutes: true },
    }),
    getSlaPolicies(prisma, organizationId),
    getIntegrationConfigStatus(prisma, organizationId, "zendesk"),
    getIntegrationConfigStatus(prisma, organizationId, "linear"),
    getIntegrationConfigStatus(prisma, organizationId, "jira"),
    getIntegrationConfigStatus(prisma, organizationId, "slack"),
  ]);

  const zendeskCredentials =
    (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;

  return {
    zendesk: {
      ...toConnectionView(zendeskIntegration),
      subdomain: zendeskCredentials?.subdomain ?? null,
    },
    jira: toConnectionView(jiraIntegration),
    linear: toConnectionView(linearIntegration),
    slack: {
      connected: slackIntegration !== null,
      teamName: slackIntegration?.teamName ?? null,
      channelId: slackIntegration?.channelId ?? null,
      channelName: slackIntegration?.channelName ?? null,
      installedAt: slackIntegration?.installedAt ?? null,
    },
    jiraConfig,
    zendeskConfig,
    linearConfig,
    slackConfig,
    engineeringLegTargetMinutes:
      organization?.engineeringLegTargetMinutes ?? null,
    slaPolicies,
  };
}
