import { getPrismaClient } from "@sla/db";
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

async function tick(kind: CycleKind): Promise<void> {
  if (inFlight) {
    console.log(JSON.stringify({ event: "cycle_skipped", kind, reason: "another cycle in flight" }));
    return;
  }

  inFlight = true;
  const startedAt = Date.now();
  try {
    const result = await runCycle(prisma, config, kind);
    console.log(JSON.stringify({ event: "cycle_finished", durationMs: Date.now() - startedAt, ...result }));
  } catch (error) {
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
}

console.log(
  JSON.stringify({
    event: "worker_started",
    activePollMs: config.activePollMs,
    reconciliationMs: config.reconciliationMs,
    appUrlConfigured: config.appUrl !== null,
  }),
);

const timers = [
  setInterval(() => void tick("active_set_poll"), config.activePollMs),
  setInterval(() => void tick("reconciliation_sweep"), config.reconciliationMs),
];

void tick("active_set_poll");

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ event: "worker_stopping", signal }));
  for (const timer of timers) clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
