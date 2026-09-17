/**
 * Pure domain types for the SLA/OLA engine.
 *
 * These are plain data shapes, not Prisma models — `packages/core` has zero
 * dependency on `packages/db` or any provider SDK. The engine takes and
 * returns these types; persistence and provider adapters live elsewhere.
 */

// Semantic states, never provider strings. A Zendesk "Pending" and a Jira
// "Waiting on Customer" both normalize to `pending_customer`; the engine
// never learns which provider it came from.
export type NormalizedState =
  | "new"
  | "open"
  | "pending_customer"
  | "pending_internal"
  | "in_progress"
  | "escalated"
  | "resolved"
  | "closed";

export type Actor = "customer" | "agent" | "system";

export type SourceSystem = "zendesk" | "jira" | "linear" | "intercom" | "github";

export type NormalizedEventType =
  | "case_created"
  | "state_changed"
  | "issue_linked"
  | "issue_unlinked"
  | "case_closed"
  // A public reply from an agent on the ticket source — what completes a
  // first-response commitment. Carries no state (`fromState`/`toState` null).
  | "agent_replied";

export interface NormalizedEvent {
  id: string;
  caseId: string;
  type: NormalizedEventType;
  occurredAt: string; // ISO 8601
  actor: Actor;
  system: SourceSystem;
  fromState: NormalizedState | null;
  toState: NormalizedState | null;
  sourceRawEventId: string;
}

export type CommitmentKind = "first_response" | "resolution";
export type CommitmentStatus =
  | "on_track"
  | "at_risk"
  | "met"
  | "breached"
  | "cancelled";

export interface SLAPolicyMatch {
  priority?: string[];
  customerIds?: string[];
  tier?: string[];
}

export interface SLAPolicyVersion {
  id: string;
  policyId: string;
  version: number;
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
  pauseOnStates: NormalizedState[];
  calendarVersionId: string;
  warnAtPercent: number[]; // e.g. [50, 80, 95]
  effectiveFrom: string; // ISO 8601
}

export interface CaseAttributes {
  caseId: string;
  priority?: string;
  customerId?: string;
  tier?: string;
}

export interface WeeklyWindow {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  openMinute: number; // minutes since local midnight
  closeMinute: number;
}

export interface BusinessCalendarVersion {
  id: string;
  version: number;
  timezone: string; // IANA name, e.g. "America/New_York"
  weekly: WeeklyWindow[];
  holidays: string[]; // ISO dates, "YYYY-MM-DD", interpreted in `timezone`
  alwaysOpen: boolean;
}

export interface Commitment {
  id: string;
  caseId: string;
  kind: CommitmentKind;
  policyVersionId: string; // frozen at creation — the reproducibility anchor
  calendarVersionId: string;
  startedAt: string; // ISO 8601
  targetMinutes: number;
  // Nominal deadline, frozen at creation as startedAt + target working time.
  // It ignores pauses, so it is not the SLA deadline once a pause can apply —
  // `Evaluation.effectiveDueAt` is.
  dueAt: string; // ISO 8601
  status: CommitmentStatus;
  closedAt?: string;
}

/**
 * The SLA clock at an evaluation's cutoff, from the same event fold that
 * produced its elapsed time: `running`, `paused` on a `pauseOnStates` state,
 * or `stopped` because the commitment completed (`findCompletionEvent`).
 */
export type ClockState = "running" | "paused" | "stopped";

/**
 * A stable reference to the normalized event an Evaluation was based on.
 * NormalizedEvent ids are regenerated on every normalization run, so this
 * names the event by what survives that: the immutable RawEvent it was
 * derived from plus the event's own facts.
 */
export interface EvaluationEventRef {
  sourceRawEventId: string;
  system: SourceSystem;
  type: NormalizedEventType;
  occurredAt: string; // ISO 8601
  toState: NormalizedState | null;
}

export interface Evaluation {
  id: string;
  commitmentId: string;
  evaluatedAt: string; // ISO 8601
  elapsedWorkingMinutes: number;
  remainingMinutes: number;
  status: CommitmentStatus;
  breachedByMinutes?: number;
  // Whole-second forms of the minute fields above, for persistence and
  // display: `elapsedSeconds` rounds down, and `remainingSeconds` is exactly
  // `targetMinutes * 60 - elapsedSeconds`.
  elapsedSeconds: number;
  remainingSeconds: number;
  breachedBySeconds?: number;
  clock: {
    state: ClockState;
    pausedSince: string | null; // ISO 8601, set only while paused
    pauseCause: NormalizedState | null;
  };
  // When the target is (or was) reached per the event fold: the breach
  // instant once breached, the projected deadline while running, and null
  // when it can't be known yet (paused before the target) or never came
  // (closed within target). Unlike `Commitment.dueAt`, it accounts for pauses.
  effectiveDueAt: string | null;
  // The highest `warnAtPercent` threshold crossed this evaluation, or
  // `BREACH_NOTIFICATION_THRESHOLD` once breached. Undefined for on_track,
  // met, and cancelled — nothing to notify. This is what
  // packages/commitments' evaluation pipeline reads to decide which
  // (commitmentId, threshold) notifications are candidates for Phase 13.7 —
  // deliberately independent of whether this Evaluation gets persisted,
  // since a commitment can sit in "at_risk" for many cycles while climbing
  // through 50% -> 80% -> 95% without its coarse status ever changing.
  warnThresholdCrossed?: number;
  inputs: {
    lastEvent: EvaluationEventRef | null;
    policyVersionId: string;
    calendarVersionId: string;
  };
}

export type Leg = "support" | "engineering" | "waiting_customer" | "unknown";
export type Confidence = "certain" | "inferred" | "unknown";

export interface LegSpan {
  leg: Leg;
  confidence: Confidence;
  startedAt: string; // ISO 8601
  endedAt: string | null; // null means still open (ongoing span)
  note?: string;
}

export interface LegDerivationWarning {
  kind: "impossible_span" | "ambiguous_handoff";
  message: string;
  at: string; // ISO 8601
}

export interface LegDerivationResult {
  spans: LegSpan[];
  warnings: LegDerivationWarning[];
}

export interface PausedInterval {
  start: string; // ISO 8601
  end: string; // ISO 8601, exclusive
  cause: NormalizedState;
}

export interface ClockFold {
  runningIntervals: { start: Date; end: Date }[];
  pausedIntervals: PausedInterval[];
  currentPause: { since: string; cause: NormalizedState } | null;
}

export interface ElapsedResult {
  elapsedWorkingMinutes: number;
  pausedIntervals: PausedInterval[];
}
