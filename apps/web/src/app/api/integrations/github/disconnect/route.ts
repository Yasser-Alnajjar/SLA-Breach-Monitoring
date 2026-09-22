import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient, Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { requireOwner } from "@/lib/authz";

/**
 * Soft-disconnects the GitHub integration: clears credentials and marks the
 * row disconnected, but never deletes it — RawEvent.integrationId cascades on
 * delete and would destroy the immutable replay log the architecture depends
 * on. The worker's cycle query excludes `disconnected` integrations, so
 * polling stops on the next tick.
 *
 * No vendor-side token revocation call is made: GitHub Apps have a
 * revoke endpoint, but scoping this to "clear the local credentials" matches
 * every other provider in this codebase (Zendesk/Jira/Linear/Intercom) and
 * is what actually stops further access from this app either way.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = requireOwner(session);
  if (denied) return denied;

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId: session.user.organizationId, provider: "github" } },
  });

  if (!integration) {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 404 });
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
