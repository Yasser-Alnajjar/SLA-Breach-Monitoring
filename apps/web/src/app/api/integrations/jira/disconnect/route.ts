import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient, Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";

/**
 * Soft-disconnects the Jira integration: clears credentials and marks the
 * row disconnected, but never deletes it — RawEvent.integrationId cascades on
 * delete and would destroy the immutable replay log the architecture depends
 * on (roadmap step 17). The worker's cycle query excludes `disconnected`
 * integrations, so polling stops on the next tick.
 *
 * No vendor-side token revocation call is made: Atlassian's 3LO OAuth apps
 * have no public self-service revoke endpoint, so only the local credentials
 * are cleared.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId: session.user.organizationId, provider: "jira" } },
  });

  if (!integration) {
    return NextResponse.json({ error: "Jira is not connected" }, { status: 404 });
  }

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      credentials: Prisma.JsonNull,
      status: "disconnected",
      disconnectedAt: new Date(),
      lastSyncError: null,
    },
  });

  return NextResponse.json({ status: "disconnected" });
}
