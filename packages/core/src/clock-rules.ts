import type { CommitmentKind, NormalizedState, SLAPolicyVersion } from "./types";

interface CommitmentClockRule {
  /** The states that pause this commitment's SLA clock under `policyVersion`. */
  pauseStates(policyVersion: SLAPolicyVersion): NormalizedState[];
}

/**
 * Each commitment kind's own clock rules. Keyed by every `CommitmentKind`, so
 * a new kind does not compile until its pause behavior is defined here — no
 * kind inherits another's by default.
 *
 * - `first_response` never pauses: a customer being asked for more
 *   information doesn't excuse a late first reply.
 * - `resolution` pauses on the policy version's `pauseOnStates`.
 * - `next_reply` never pauses: a reply is owed whatever state the case is in.
 */
const COMMITMENT_CLOCK_RULES: Record<CommitmentKind, CommitmentClockRule> = {
  first_response: { pauseStates: () => [] },
  resolution: { pauseStates: (policyVersion) => policyVersion.pauseOnStates },
  next_reply: { pauseStates: () => [] },
};

/**
 * The states that pause a commitment of `kind` under `policyVersion` — what
 * the SLA clock (`foldClockIntervals`) must be given for that commitment,
 * never `policyVersion.pauseOnStates` directly.
 */
export function pauseStatesFor(kind: CommitmentKind, policyVersion: SLAPolicyVersion): NormalizedState[] {
  return COMMITMENT_CLOCK_RULES[kind].pauseStates(policyVersion);
}

/** Whether a commitment of `kind` under `policyVersion` pauses while the case is in `state`. */
export function commitmentPausesOn(
  kind: CommitmentKind,
  state: NormalizedState,
  policyVersion: SLAPolicyVersion,
): boolean {
  return pauseStatesFor(kind, policyVersion).includes(state);
}
