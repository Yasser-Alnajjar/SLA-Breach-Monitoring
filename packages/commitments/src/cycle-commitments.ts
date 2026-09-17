import type { Prisma, PrismaClient } from "@sla/db";
import {
  createCommitment,
  type BusinessCalendarVersion,
  type CommitmentStatus,
  type NextReplyCycle,
  type SLAPolicyVersion,
} from "@sla/core";

/** The persisted fields `planCycleCommitments` matches a derived cycle against. */
export interface CycleCommitmentRecord {
  id: string;
  cycleKey: string;
  status: CommitmentStatus;
  /** Non-null once finalized (met/breached) or cancelled. Never cleared except by restore. */
  closedAt: Date | null;
}

/**
 * How a case's persisted Next Reply commitments must change to match its
 * derived cycles. Matching is by `cycleKey` alone, so a cycle keeps its row
 * — and its evaluations and notifications — however often it is re-derived.
 */
export interface CycleCommitmentPlan {
  /** Derived cycles with no commitment yet. */
  create: NextReplyCycle[];
  /**
   * Unfinalized (`closedAt === null`) commitments whose cycle is no longer
   * derived (e.g. its anchor reply was removed on renormalization). A
   * finalized commitment (met/breached) is never cancelled, even if its
   * cycle disappears — its historical outcome, `closedAt`, and any
   * evaluations/notifications stay exactly as they are.
   */
  cancel: string[];
  /** Cancelled commitments whose cycle is derived again. */
  restore: string[];
}

/**
 * Pure: plans the writes that make a case's Next Reply commitments match
 * `cycles`. A vanished cycle's still-unfinalized commitment is cancelled
 * rather than deleted, so its history stays explainable; a cancelled one
 * whose cycle comes back is restored rather than duplicated. A commitment
 * that already reached `met`/`breached` before its cycle disappeared is left
 * untouched — cancellation only ever applies to a live, unfinalized cycle,
 * never to a settled historical outcome. Planning against the result of
 * applying a plan yields an empty plan.
 */
export function planCycleCommitments(
  existing: readonly CycleCommitmentRecord[],
  cycles: readonly NextReplyCycle[],
): CycleCommitmentPlan {
  const derivedKeys = new Set<string>();
  for (const cycle of cycles) {
    if (derivedKeys.has(cycle.key)) throw new Error(`Duplicate Next Reply cycle key ${cycle.key}`);
    derivedKeys.add(cycle.key);
  }
  const existingKeys = new Set(existing.map((row) => row.cycleKey));

  return {
    create: cycles.filter((cycle) => !existingKeys.has(cycle.key)),
    cancel: existing
      .filter((row) => row.status !== "cancelled" && row.closedAt === null && !derivedKeys.has(row.cycleKey))
      .map((row) => row.id),
    restore: existing
      .filter((row) => row.status === "cancelled" && derivedKeys.has(row.cycleKey))
      .map((row) => row.id),
  };
}

export interface PersistNextReplyCommitmentsInput {
  caseId: string;
  /** Every Next Reply cycle derived for the case (`deriveNextReplyCycles`), as of `asOf`. */
  cycles: readonly NextReplyCycle[];
  /** Frozen onto newly created commitments; existing ones keep theirs. */
  policyVersion: SLAPolicyVersion;
  calendarVersion: BusinessCalendarVersion;
  /** Stamped as `closedAt` on commitments this run cancels. */
  asOf: string;
}

export interface PersistNextReplyCommitmentsResult {
  created: number;
  cancelled: number;
  restored: number;
}

/**
 * Makes a case's persisted Next Reply commitments match its derived cycles
 * (`planCycleCommitments`), in one transaction. Idempotent: re-running with
 * the same cycles writes nothing, and a concurrent run can't duplicate a
 * cycle — `@@unique([caseId, kind, cycleKey])` plus `skipDuplicates`.
 *
 * A new commitment starts at its cycle's `startedAt`. A restored one comes
 * back `on_track` and unfinalized; the evaluation pipeline sets its real
 * status on its next run. A finalized commitment (met/breached) is never
 * cancelled or restored — its `closedAt` and history are never rewritten.
 */
export async function persistNextReplyCommitments(
  prisma: PrismaClient,
  input: PersistNextReplyCommitmentsInput,
): Promise<PersistNextReplyCommitmentsResult> {
  const { caseId, cycles, policyVersion, calendarVersion, asOf } = input;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.commitment.findMany({
      where: { caseId, kind: "next_reply" },
      select: { id: true, cycleKey: true, status: true, closedAt: true },
    });
    const plan = planCycleCommitments(existing, cycles);

    let created = 0;
    if (plan.create.length > 0) {
      const data = plan.create.map((cycle) => {
        const commitment = createCommitment(
          caseId,
          "next_reply",
          cycle.startedAt,
          policyVersion,
          calendarVersion,
          cycle.key,
        );
        return {
          id: commitment.id,
          caseId: commitment.caseId,
          kind: commitment.kind,
          cycleKey: commitment.cycleKey,
          policyVersionId: commitment.policyVersionId,
          calendarVersionId: commitment.calendarVersionId,
          startedAt: new Date(commitment.startedAt),
          targetMinutes: commitment.targetMinutes,
          dueAt: new Date(commitment.dueAt),
          status: commitment.status,
        } satisfies Prisma.CommitmentCreateManyInput;
      });
      created = (await tx.commitment.createMany({ data, skipDuplicates: true })).count;
    }

    const cancelled =
      plan.cancel.length > 0
        ? (
            await tx.commitment.updateMany({
              // closedAt: null belt-and-suspenders alongside planCycleCommitments'
              // own filter — a finalized commitment's outcome is never overwritten.
              where: { id: { in: plan.cancel }, status: { not: "cancelled" }, closedAt: null },
              data: { status: "cancelled", closedAt: new Date(asOf) },
            })
          ).count
        : 0;

    const restored =
      plan.restore.length > 0
        ? (
            await tx.commitment.updateMany({
              where: { id: { in: plan.restore }, status: "cancelled" },
              data: { status: "on_track", closedAt: null },
            })
          ).count
        : 0;

    return { created, cancelled, restored };
  });
}
