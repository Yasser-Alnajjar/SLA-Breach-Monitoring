import { getOrCreateWorkerSettings, getPrismaClient, recordWorkerCycleOutcome, recordWorkerNextRun } from "@sla/db";
import { loadWorkerConfig } from "./config";
import { runCycle, type CycleKind } from "./cycle";

const prisma = getPrismaClient();
const config = loadWorkerConfig();

/**
 * Cycles are serialized: both kinds advance the same per-integration cursor,
 * so running two at once would race on it and double-fetch. A cycle requested
 * while another is in flight is skipped rather than queued — the next tick
 * picks up the same work, and skipping is harmless because every stage is
 * idempotent (`(integrationId, providerEventId)` on RawEvent, a deterministic
 * Evaluation id, `@@unique([caseId, kind])` on Commitment).
 */
let inFlight = false;
let shuttingDown = false;

/**
 * `setTimeout`, not `setInterval`: each kind reschedules only itself, only
 * after its own tick fully finishes, re-reading the current interval from
 * the database at that point. That's what makes an owner's change from the
 * Monitoring settings page take effect on the very next tick with no
 * restart, and it's structurally impossible to end up with two timers for
 * the same kind — the next one is never created until the current run (and
 * any reschedule from a previous change) is done.
 */
const timers: Record<CycleKind, NodeJS.Timeout | null> = {
  active_set_poll: null,
  reconciliation_sweep: null,
};

async function currentIntervalMs(kind: CycleKind): Promise<number> {
  const settings = await getOrCreateWorkerSettings(prisma);
  return kind === "active_set_poll" ? settings.activePollIntervalMs : settings.reconciliationIntervalMs;
}

function scheduleNext(kind: CycleKind): void {
  if (shuttingDown) return;
  void currentIntervalMs(kind).then(async (intervalMs) => {
    if (shuttingDown) return;
    // Persisted here — the moment a timer is actually armed — rather than
    // derived from `last*At + intervalMs` anywhere downstream: this is the
    // one place that knows both the just-read interval and that a timer is
    // really about to be set for it.
    await recordWorkerNextRun(prisma, kind, new Date(Date.now() + intervalMs));
    if (shuttingDown) return;
    timers[kind] = setTimeout(() => void tick(kind), intervalMs);
  });
}

async function tick(kind: CycleKind): Promise<void> {
  if (inFlight) {
    console.log(JSON.stringify({ event: "cycle_skipped", kind, reason: "another cycle in flight" }));
    scheduleNext(kind);
    return;
  }

  inFlight = true;
  const startedAt = Date.now();
  try {
    const result = await runCycle(prisma, config, kind);
    await recordWorkerCycleOutcome(prisma, kind, result.failures.length);
    console.log(JSON.stringify({ event: "cycle_finished", durationMs: Date.now() - startedAt, ...result }));
  } catch (error) {
    await recordWorkerCycleOutcome(prisma, kind, null);
    console.error(
      JSON.stringify({
        event: "cycle_failed",
        kind,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    inFlight = false;
  }

  scheduleNext(kind);
}

async function main(): Promise<void> {
  const settings = await getOrCreateWorkerSettings(prisma);
  console.log(
    JSON.stringify({
      event: "worker_started",
      activePollMs: settings.activePollIntervalMs,
      reconciliationMs: settings.reconciliationIntervalMs,
      appUrlConfigured: config.appUrl !== null,
    }),
  );

  // Active-set poll runs immediately on boot; reconciliation only after its
  // own interval first elapses — same startup order as before this file
  // moved to dynamic scheduling.
  void tick("active_set_poll");
  scheduleNext("reconciliation_sweep");
}

void main();

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ event: "worker_stopping", signal }));
  shuttingDown = true;
  for (const kind of Object.keys(timers) as CycleKind[]) {
    if (timers[kind]) clearTimeout(timers[kind]);
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
