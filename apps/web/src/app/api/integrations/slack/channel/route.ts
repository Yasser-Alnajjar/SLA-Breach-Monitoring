import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { requireOwner } from "@/lib/authz";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = requireOwner(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { channelId?: string; channelName?: string } | null;
  const channelId = body?.channelId?.trim();
  const channelName = body?.channelName?.trim();
  if (!channelId || !channelName) {
    return NextResponse.json({ error: "channelId and channelName are required" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  const slack = await prisma.slackIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (!slack) return NextResponse.json({ error: "Slack is not connected" }, { status: 404 });

  await prisma.slackIntegration.update({
    where: { organizationId: session.user.organizationId },
    data: { channelId, channelName },
  });

  return NextResponse.json({ channelId, channelName });
}
