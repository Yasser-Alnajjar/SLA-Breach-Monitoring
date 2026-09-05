import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { runZendeskBackfill, type ZendeskCredentials } from "@sla/zendesk";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: { organizationId: session.user.organizationId, provider: "zendesk" },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Zendesk is not connected" }, { status: 404 });
  }

  try {
    const result = await runZendeskBackfill(
      prisma,
      integration.id,
      integration.credentials as unknown as ZendeskCredentials,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
