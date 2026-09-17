import { randomUUID } from "node:crypto";
import { computeDeadline } from "./calendar";
import type {
  BusinessCalendarVersion,
  CaseAttributes,
  Commitment,
  CommitmentKind,
  SLAPolicyVersion,
} from "./types";
import { SINGLE_CYCLE_KEY } from "./types";

function specificity(match: SLAPolicyVersion["match"]): number {
  return (
    (match.priority?.length ? 1 : 0) +
    (match.customerIds?.length ? 1 : 0) +
    (match.tier?.length ? 1 : 0)
  );
}

function matches(
  caseAttributes: CaseAttributes,
  policyVersion: SLAPolicyVersion,
): boolean {
  const { match } = policyVersion;
  if (
    match.priority &&
    (!caseAttributes.priority ||
      !match.priority.includes(caseAttributes.priority))
  )
    return false;
  if (
    match.customerIds &&
    (!caseAttributes.customerId ||
      !match.customerIds.includes(caseAttributes.customerId))
  )
    return false;
  if (
    match.tier &&
    (!caseAttributes.tier || !match.tier.includes(caseAttributes.tier))
  )
    return false;
  return true;
}

/**
 * Matches a Case's attributes against active policy versions, most
 * specific first (Phase 13.1). A policy version with more defined match
 * criteria outranks one with fewer, provided all of its defined criteria
 * are satisfied. Ties break on the higher version number, then on `id` for
 * full determinism.
 */
export function matchPolicyVersion(
  caseAttributes: CaseAttributes,
  activePolicyVersions: SLAPolicyVersion[],
): SLAPolicyVersion | null {
  const candidates = activePolicyVersions.filter((pv) =>
    matches(caseAttributes, pv),
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const specificityDelta = specificity(b.match) - specificity(a.match);
    if (specificityDelta !== 0) return specificityDelta;
    const versionDelta = b.version - a.version;
    if (versionDelta !== 0) return versionDelta;
    return a.id.localeCompare(b.id);
  });

  return candidates[0]!;
}

/**
 * Creates a Commitment for a Case under a specific policy and calendar
 * version, freezing both ids onto the result permanently (Phase 13.1).
 * Later edits to the policy or calendar create new versions and never
 * retroactively affect this commitment. `cycleKey` defaults to
 * `SINGLE_CYCLE_KEY`; a Next Reply commitment passes its cycle's key.
 */
export function createCommitment(
  caseId: string,
  kind: CommitmentKind,
  startedAt: string,
  policyVersion: SLAPolicyVersion,
  calendarVersion: BusinessCalendarVersion,
  cycleKey: string = SINGLE_CYCLE_KEY,
): Commitment {
  const target = policyVersion.targets.find((t) => t.kind === kind);
  if (!target) {
    throw new Error(
      `Policy version ${policyVersion.id} has no target for commitment kind "${kind}"`,
    );
  }

  const dueAt = computeDeadline(startedAt, target.minutes, calendarVersion);

  return {
    id: randomUUID(),
    caseId,
    kind,
    cycleKey,
    policyVersionId: policyVersion.id,
    calendarVersionId: calendarVersion.id,
    startedAt,
    targetMinutes: target.minutes,
    dueAt: dueAt.toISOString(),
    status: "on_track",
  };
}
