import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { listAuthorizedOrganizations, listSourceIntegrations } from "@/lib/concierge-access";
import {
  DEFAULT_EXPORT_SINCE_DAYS,
  MAX_EXPORT_SINCE_DAYS,
  type ConciergeSourceProvider,
} from "@/lib/types/concierge-export";

/** GET handler shared by `/api/concierge/{jira,zendesk}/integrations`: one accessible organization's integrations, display fields only. */
export async function listIntegrationsResponse(request: NextRequest, provider: ConciergeSourceProvider) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });

  const prisma = getPrismaClient();
  const organizations = await listAuthorizedOrganizations(prisma, session);
  if (!organizations.some((organization) => organization.id === organizationId)) {
    return NextResponse.json({ error: "You don't have access to this organization" }, { status: 403 });
  }

  return NextResponse.json({ integrations: await listSourceIntegrations(prisma, organizationId, provider) });
}

/** The export window from a request body, or null when it's out of range. */
export function parseSinceDays(value: unknown): number | null {
  const sinceDays = value === undefined ? DEFAULT_EXPORT_SINCE_DAYS : Number(value);
  return Number.isInteger(sinceDays) && sinceDays >= 1 && sinceDays <= MAX_EXPORT_SINCE_DAYS ? sinceDays : null;
}

export const invalidSinceDaysResponse = () =>
  NextResponse.json({ error: `sinceDays must be a whole number from 1 to ${MAX_EXPORT_SINCE_DAYS}` }, { status: 400 });

/** A ZIP download, with the counts the page shows in headers so it needn't unzip anything. */
export function zipResponse(zip: Uint8Array, fileName: string, counts: { records: number; history: number }) {
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(counts.records),
      "X-Export-History-Count": String(counts.history),
    },
  });
}
