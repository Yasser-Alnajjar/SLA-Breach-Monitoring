import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { deriveWorkerStatus, getPrismaClient, saveWorkerSettings, WorkerSettingsValidationError } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { isPlatformOperator, requirePlatformOperator } from "@/lib/authz";
import { getWorkerMonitoringData } from "@/lib/worker-settings-data";

/** Viewable by any signed-in organization member — see `requirePlatformOperator` for why only the write path is gated. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const data = await getWorkerMonitoringData(prisma, isPlatformOperator(session));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const denied = requirePlatformOperator(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as
    | { activePollIntervalMs?: number; reconciliationIntervalMs?: number }
    | null;

  if (typeof body?.activePollIntervalMs !== "number" || typeof body?.reconciliationIntervalMs !== "number") {
    return NextResponse.json(
      { error: "activePollIntervalMs and reconciliationIntervalMs are required" },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  try {
    const settings = await saveWorkerSettings(prisma, {
      activePollIntervalMs: body.activePollIntervalMs,
      reconciliationIntervalMs: body.reconciliationIntervalMs,
    });
    return NextResponse.json({
      activePollIntervalMs: settings.activePollIntervalMs,
      reconciliationIntervalMs: settings.reconciliationIntervalMs,
      status: deriveWorkerStatus(settings),
      lastActivePollAt: settings.lastActivePollAt?.toISOString() ?? null,
      nextActivePollAt: settings.nextActivePollAt?.toISOString() ?? null,
      lastReconciliationAt: settings.lastReconciliationAt?.toISOString() ?? null,
      nextReconciliationAt: settings.nextReconciliationAt?.toISOString() ?? null,
      canEdit: true,
    });
  } catch (error) {
    if (error instanceof WorkerSettingsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
