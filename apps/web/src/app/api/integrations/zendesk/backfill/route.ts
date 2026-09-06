import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import {
  runZendeskBackfill,
  runZendeskBusinessCalendarImport,
  runZendeskNormalization,
  runZendeskSlaPolicyImport,
  ZendeskReauthRequiredError,
} from "@sla/zendesk";
import { runCommitmentPipeline } from "@sla/commitments";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getZendeskOAuthConfig } from "@/lib/zendesk-env";

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

  let config;
  try {
    config = getZendeskOAuthConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Zendesk OAuth is not configured" },
      { status: 500 },
    );
  }

  try {
    const backfill = await runZendeskBackfill(prisma, integration.id, config);
    const normalization = await runZendeskNormalization(prisma, integration.id);
    const businessCalendarImport = await runZendeskBusinessCalendarImport(prisma, integration.id);
    const slaPolicyImport = await runZendeskSlaPolicyImport(prisma, integration.id);
    const commitments = await runCommitmentPipeline(prisma, session.user.organizationId);
    return NextResponse.json({ backfill, normalization, businessCalendarImport, slaPolicyImport, commitments });
  } catch (error) {
    if (error instanceof ZendeskReauthRequiredError) {
      return NextResponse.json(
        { error: "Zendesk needs to be reconnected", reauthRequired: true },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
