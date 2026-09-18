import { deriveWorkerStatus, getOrCreateWorkerSettings, type PrismaClient } from "@sla/db";
import type { WorkerMonitoringData } from "./types/worker-settings";

/**
 * Assembles the Monitoring settings page's read model. Worker settings are
 * global (shared by every organization — see `@sla/db`'s `WorkerSettings`
 * doc comment), so unlike every other `*-data.ts` in this directory this
 * takes no `organizationId`; `canEdit` (see `isPlatformOperator` in
 * `@/lib/authz`) only decides whether the page renders the edit control —
 * every tenant, including an org owner, gets a read-only view.
 */
export async function getWorkerMonitoringData(
  prisma: PrismaClient,
  canEdit: boolean,
): Promise<WorkerMonitoringData> {
  const settings = await getOrCreateWorkerSettings(prisma);

  return {
    activePollIntervalMs: settings.activePollIntervalMs,
    reconciliationIntervalMs: settings.reconciliationIntervalMs,
    status: deriveWorkerStatus(settings),
    lastActivePollAt: settings.lastActivePollAt?.toISOString() ?? null,
    nextActivePollAt: settings.nextActivePollAt?.toISOString() ?? null,
    lastReconciliationAt: settings.lastReconciliationAt?.toISOString() ?? null,
    nextReconciliationAt: settings.nextReconciliationAt?.toISOString() ?? null,
    canEdit,
  };
}
