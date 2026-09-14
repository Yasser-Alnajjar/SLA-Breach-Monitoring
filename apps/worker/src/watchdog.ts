import { getOrCreateWorkerSettings, type PrismaClient } from "@sla/db";
import { sendOpsAlert, type OpsAlertConfig } from "./ops-alert";
import { captureMessage } from "./sentry";

export type CycleKind = "active_set_poll" | "reconciliation_sweep";

/**
 * How many missed intervals in a row count as "stalled" before alerting —
 * the same 3x floor `deriveWorkerStatus` (@sla/db) uses for its own
 * "stopped" heartbeat check. A cycle running a little slow (a GC pause, a
 * slow provider API on one org) must never page anyone; this only fires
 * once a cycle has gone conspicuously quiet.
 */
const STALL_MULTIPLIER = 3;
const MIN_STALL_MS = 60_000;

/**
 * How often this file's own timer re-checks — independent of either
 * cycle's own interval, since a stalled worker is, by definition, not
 * re-checking itself on schedule.
 */
const CHECK_INTERVAL_MS = 2 * 60_000;

/**
 * Per-kind "have we already alerted for the stall that's currently in
 * progress" — in-memory, not persisted: this process is the only thing
 * that can run this check at all (see this module's own limitation below),
 * so a restart already means a fresh incident either way, and re-alerting
 * once after a restart is harmless. Cleared the moment the kind recovers, so
 * a later, separate stall alerts again rather than staying silently muted.
 */
const alerted = new Set<CycleKind>();

function isStalled(lastRunAt: Date | null, intervalMs: number, now: number): boolean {
  const ageMs = lastRunAt ? now - lastRunAt.getTime() : Infinity;
  return ageMs > Math.max(intervalMs * STALL_MULTIPLIER, MIN_STALL_MS);
}

export async function checkForStalledCycles(
  prisma: PrismaClient,
  opsAlertConfig: OpsAlertConfig | null,
): Promise<void> {
  const settings = await getOrCreateWorkerSettings(prisma);
  const now = Date.now();

  const kinds: { kind: CycleKind; lastRunAt: Date | null; intervalMs: number }[] = [
    { kind: "active_set_poll", lastRunAt: settings.lastActivePollAt, intervalMs: settings.activePollIntervalMs },
    {
      kind: "reconciliation_sweep",
      lastRunAt: settings.lastReconciliationAt,
      intervalMs: settings.reconciliationIntervalMs,
    },
  ];

  for (const { kind, lastRunAt, intervalMs } of kinds) {
    const stalled = isStalled(lastRunAt, intervalMs, now);
    const alreadyAlerted = alerted.has(kind);

    if (stalled && !alreadyAlerted) {
      alerted.add(kind);
      const message =
        `${kind} hasn't completed successfully in over ${STALL_MULTIPLIER}x its configured ` +
        `${Math.round(intervalMs / 60_000)}-minute interval (last completed run: ${lastRunAt?.toISOString() ?? "never"}).`;
      captureMessage(`SLA worker stalled: ${kind}`, { kind, lastRunAt, intervalMs, level: "error" });
      console.error(JSON.stringify({ event: "cycle_stalled", kind, lastRunAt, intervalMs }));
      await sendOpsAlert(opsAlertConfig, { subject: `SLA worker stalled: ${kind}`, message });
    } else if (!stalled && alreadyAlerted) {
      alerted.delete(kind);
      console.log(JSON.stringify({ event: "cycle_recovered", kind }));
      await sendOpsAlert(opsAlertConfig, {
        subject: `SLA worker recovered: ${kind}`,
        message: `${kind} is completing cycles again.`,
      });
    }
  }
}

/**
 * Limitation worth stating explicitly: this only catches a worker that's
 * alive but not completing cycles (repeated failures, or a hung await). A
 * fully crashed/exited process stops this timer along with everything
 * else — that failure mode is what the container-level `HEALTHCHECK`
 * against `health-server.ts`'s `/health` (and the orchestrator's restart
 * policy) is for, not this. Full external watchdog infrastructure is this
 * step's stated non-goal.
 */
export function startStalledCycleWatchdog(prisma: PrismaClient, opsAlertConfig: OpsAlertConfig | null): NodeJS.Timeout {
  return setInterval(() => void checkForStalledCycles(prisma, opsAlertConfig), CHECK_INTERVAL_MS);
}
