import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { JiraReauthRequiredError, runJiraBackfill, runJiraCorrelation, runJiraNormalization } from "@sla/jira";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getJiraOAuthConfig } from "@/lib/jira-env";

export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: { organizationId: session.user.organizationId, provider: "jira" },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Jira is not connected" }, { status: 404 });
  }

  let config;
  try {
    config = getJiraOAuthConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jira OAuth is not configured" },
      { status: 500 },
    );
  }

  try {
    const backfill = await runJiraBackfill(prisma, integration.id, config);
    const correlation = await runJiraCorrelation(prisma, integration.id);
    const normalization = await runJiraNormalization(prisma, integration.id);
    return NextResponse.json({ backfill, correlation, normalization });
  } catch (error) {
    if (error instanceof JiraReauthRequiredError) {
      return NextResponse.json({ error: "Jira needs to be reconnected", reauthRequired: true }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
