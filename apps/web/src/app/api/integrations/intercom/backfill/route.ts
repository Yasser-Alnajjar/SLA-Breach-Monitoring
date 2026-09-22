import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { IntercomReauthRequiredError, runIntercomBackfill, runIntercomNormalization } from "@sla/intercom";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { requireOwner } from "@/lib/authz";

export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = requireOwner(session);
  if (denied) return denied;

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: { organizationId: session.user.organizationId, provider: "intercom" },
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Intercom is not connected" }, { status: 404 });
  }

  try {
    const backfill = await runIntercomBackfill(prisma, integration.id);
    const normalization = await runIntercomNormalization(prisma, integration.id);
    return NextResponse.json({ backfill, normalization });
  } catch (error) {
    if (error instanceof IntercomReauthRequiredError) {
      return NextResponse.json({ error: "Intercom needs to be reconnected", reauthRequired: true }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 502 },
    );
  }
}
