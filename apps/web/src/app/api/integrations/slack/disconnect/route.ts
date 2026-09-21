import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

/**
 * Unlike Zendesk/Jira/Linear/Intercom/GitHub (which soft-disconnect —
 * `credentials: null` + `status: "disconnected"` — to protect the
 * `RawEvent` replay log those integrations feed), `SlackIntegration` has no
 * ingestion or cascade dependency: it's a notification-only sink with no
 * `RawEvent` stream of its own. A straightforward row delete is sufficient
 * and matches this integration's shape — no unused `status`/`disconnectedAt`
 * columns to add for something with nothing to preserve.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const slack = await prisma.slackIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!slack) {
    return NextResponse.json({ error: "Slack is not connected" }, { status: 404 });
  }

  await prisma.slackIntegration.delete({ where: { organizationId: session.user.organizationId } });

  return NextResponse.json({ status: "disconnected" });
}
