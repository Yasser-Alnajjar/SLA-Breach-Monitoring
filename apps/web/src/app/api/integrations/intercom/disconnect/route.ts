import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient, Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";

/**
 * Soft-disconnects the Intercom integration: clears credentials and marks the
 * row disconnected, but never deletes it — RawEvent.integrationId cascades on
 * delete and would destroy the immutable replay log the architecture depends
 * on (roadmap step 17). The worker's cycle query excludes `disconnected`
 * integrations, so polling stops on the next tick.
 *
 * No vendor-side token revocation call is made: Intercom's OAuth API
 * documents no self-service revoke endpoint, so only the local credentials
 * are cleared (mirrors @sla/linear's disconnect).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId: session.user.organizationId, provider: "intercom" } },
  });

  if (!integration) {
    return NextResponse.json({ error: "Intercom is not connected" }, { status: 404 });
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
