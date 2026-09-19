import type { PrismaClient } from "../generated/prisma/client";

// Generous on purpose: a caller queued behind another's projection waits
// inside this transaction, and only the lock (no rows) is held meanwhile.
const LOCK_WAIT_TIMEOUT_MS = 15 * 60_000;

/**
 * Runs `work` while holding a per-organization Postgres advisory lock, so
 * normalization and the commitment/cycle/evaluation/notification pipeline
 * tail for one organization never run concurrently from two call sites —
 * the worker's own cycle, a Zendesk/Jira webhook delivery, and the
 * onboarding source-sync backfill routes all write the same Case/
 * NormalizedEvent/Commitment rows for that organization (roadmap step E-3).
 * Deliberately excludes provider backfill/ingestion: that's network-bound
 * and idempotent (RawEvent upserts), so it never needs to wait behind this
 * lock, only the DB-local projection and pipeline steps that follow it.
 *
 * The lock belongs to an otherwise idle transaction and is released when it
 * ends; `work` itself uses the regular client, since the pipelines open
 * their own transactions.
 */
export async function withOrganizationSlaLock<T>(
  prisma: PrismaClient,
  organizationId: string,
  work: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sla-processing:${organizationId}`}, 0))`;
      return work();
    },
    { maxWait: 10_000, timeout: LOCK_WAIT_TIMEOUT_MS },
  );
}
