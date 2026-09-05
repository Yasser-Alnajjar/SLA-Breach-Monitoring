import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { listChannels } from "@sla/slack";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const slack = await prisma.slackIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (!slack) return NextResponse.json({ error: "Slack is not connected" }, { status: 404 });

  try {
    const channels = await listChannels(slack.accessToken);
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list Slack channels" },
      { status: 502 },
    );
  }
}
