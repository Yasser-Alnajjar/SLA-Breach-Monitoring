import type { Prisma } from "@sla/db";

/**
 * The one definition of "active commitment" — not yet finalized
 * (`closedAt: null`) and not cancelled. Shared by `runEvaluationPipeline`'s
 * active-set scope and `runCommitmentReResolutionPipeline` so the two can
 * never drift apart on what counts as active.
 *
 * Deliberately not `status === "on_track"`: `at_risk` is active, and so is a
 * `breached` commitment that hasn't completed yet (`closedAt` still null) —
 * only `met`, a terminal `breached` (`closedAt` set), and `cancelled` are
 * excluded.
 */
export const ACTIVE_COMMITMENT_WHERE: Prisma.CommitmentWhereInput = {
  closedAt: null,
  status: { not: "cancelled" },
};
