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
 * Whether an active Commitment's policy/target needs to change to match
 * `matchedPolicyVersion` — the currently applicable policy version for the
 * commitment's case, from a fresh `matchPolicyVersion` call (Active-Commitment
 * Re-Resolution).
 *
 * `changed` compares the underlying **policy** (`policyId`), not the specific
 * version (`id`) — decision D1. A new version of the *same* policy (a manual
 * override, a Zendesk re-import, or an edit in the policy UI) never
 * re-resolves an active commitment; only a case attribute (priority,
 * customer/organization, tier, or any future match-driving attribute)
 * changing enough that a genuinely *different* policy now matches does.
 * Deliberately generic: it never inspects which `CaseAttributes` field moved,
 * so every such attribute is handled through the same path. A calendar
 * change alone (D1b) never reaches this function at all — it doesn't affect
 * `matchPolicyVersion`'s result, so `changed` stays false and the caller
 * never recomputes `calendarVersionId` for an otherwise-unchanged commitment.
 *
 * `hasTarget` is false when `matchedPolicyVersion` has no target for the
 * commitment's `kind` (e.g. the newly-applicable policy dropped `next_reply`)
 * — the caller must leave the commitment's policy/target untouched in that
 * case rather than null it out or replace the commitment, since a
 * misconfigured newly-matched policy is not a reason to destroy an active
 * SLA commitment.
 */
export interface CommitmentPolicyResolution {
  /** True when `matchedPolicyVersion.policyId` differs from the commitment's current policy's id — a switch to a different policy, not merely a new version of the same one. */
  changed: boolean;
  /** False when `matchedPolicyVersion` has no target for the commitment's `kind`. */
  hasTarget: boolean;
}

export function resolveCommitmentPolicyChange(
  commitment: Pick<Commitment, "kind">,
  currentPolicyId: string,
  matchedPolicyVersion: SLAPolicyVersion,
): CommitmentPolicyResolution {
  return {
    changed: matchedPolicyVersion.policyId !== currentPolicyId,
    hasTarget: matchedPolicyVersion.targets.some((t) => t.kind === commitment.kind),
  };
}

/**
 * Creates a Commitment for a Case under a specific policy and calendar
 * version, freezing both ids onto the result permanently (Phase 13.1).
 * Later edits to the policy or calendar create new versions and never
 * retroactively affect this commitment. `cycleKey` defaults to
 * `SINGLE_CYCLE_KEY`; a Next Reply commitment passes its cycle's key.
 *
 * "Permanently" means for the lifetime of this exact policy match: while the
 * commitment is still active (unfinalized, uncancelled), Active-Commitment
 * Re-Resolution may update `policyVersionId`/`targetMinutes`/
 * `calendarVersionId`/`dueAt` in place if the Case's attributes change enough
 * that a different policy version now applies — `startedAt`, `cycleKey`, and
 * the commitment's identity never change. A finalized or cancelled commitment
 * is never touched by re-resolution, so "permanent" still holds once a
 * commitment is done. See `resolveCommitmentPolicyChange` and
 * `runCommitmentReResolutionPipeline` (packages/commitments).
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
