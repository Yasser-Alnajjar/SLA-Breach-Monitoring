import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { runJiraBackfill, type JiraCredentials } from "@sla/jira";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

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

  try {
    const backfill = await runJiraBackfill(
      prisma,
      integration.id,
      integration.credentials as unknown as JiraCredentials,
    );
    return NextResponse.json({ backfill });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
