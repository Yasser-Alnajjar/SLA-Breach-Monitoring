import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { GithubReauthRequiredError, runGithubBackfill, runGithubCorrelation, runGithubNormalization } from "@sla/github";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: { organizationId: session.user.organizationId, provider: "github" },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 404 });
  }

  try {
    const backfill = await runGithubBackfill(prisma, integration.id);
    const correlation = await runGithubCorrelation(prisma, integration.id);
    const normalization = await runGithubNormalization(prisma, integration.id);
    return NextResponse.json({ backfill, correlation, normalization });
  } catch (error) {
    if (error instanceof GithubReauthRequiredError) {
      return NextResponse.json({ error: "GitHub needs to be reconnected", reauthRequired: true }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
