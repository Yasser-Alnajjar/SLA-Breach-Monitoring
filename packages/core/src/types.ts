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
  | "agent_replied"
  // A public reply from the customer on the ticket source, after the case was
  // opened (the opening message is `case_created`). Internal notes never
  // produce it. Carries no state and completes no commitment on its own.
  | "customer_replied";

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
  /**
   * The event's position in its provider's own ordering (e.g. Zendesk audit
   * order, then the event's index inside the audit). Only comparable between
   * events of the same system on the same case; breaks ties between events
   * sharing an `occurredAt` (see `compareNormalizedEvents`). Absent on rows
   * written before the field existed, which sort as 0.
   */
  sourceSequence?: number;
}

export type CommitmentKind = "first_response" | "resolution" | "next_reply";

/**
 * `Commitment.cycleKey` of every single-cycle kind (first_response,
 * resolution). Multi-cycle kinds (next_reply) key each cycle by the cycle's
 * own stable key (`nextReplyCycleKey`).
 */
export const SINGLE_CYCLE_KEY = "single";
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
  // The policy's configured pause states. Not every commitment kind honors
  // them — read a commitment's effective pause states through
  // `pauseStatesFor` (clock-rules.ts), never this field directly.
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
  /**
   * Which cycle of `kind` on the case this commitment covers — unique per
   * `(caseId, kind)`. `SINGLE_CYCLE_KEY` for single-cycle kinds; a Next Reply
   * cycle's `NextReplyCycle.key` otherwise.
   */
  cycleKey: string;
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
 * produced its elapsed time: `running`, `paused` on a state that pauses the
 * commitment (`pauseStatesFor`),
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

/**
 * The span an SLA clock is measured over (`foldClockIntervals`): elapsed time
 * only accrues inside `[start, end)`. Events before `start` still set the
 * state the clock opens in. For a commitment, `start` is its `startedAt` and
 * `end` its clock cutoff (`resolveClockCutoff`).
 */
export interface ClockWindow {
  start: string; // ISO 8601
  end: string; // ISO 8601
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

/** What answered a Next Reply cycle. Only a public agent reply does. */
export type NextReplyCompletionType = "agent_replied";

/**
 * One Next Reply cycle derived from a case's event stream
 * (`deriveNextReplyCycles`): the wait from the oldest unanswered customer
 * reply to the next public agent reply. Derived, never stored as the source
 * of truth.
 */
export interface NextReplyCycle {
  /**
   * Stable identity, from the anchor customer reply's source facts (see
   * `nextReplyCycleKey`). Survives renormalization, and unlike `index` it
   * doesn't shift when an earlier cycle appears.
   */
  key: string;
  /** 0-based position among the case's cycles as of the derivation's `asOf`. */
  index: number;
  startedAt: string; // ISO 8601, the anchor's instant
  /** The oldest unanswered customer reply — the one the cycle starts at. */
  anchor: EvaluationEventRef;
  /** Every customer reply the cycle answers, in event order, anchor first. */
  customerReplies: EvaluationEventRef[];
  completedAt: string | null; // ISO 8601, null while unanswered
  completion: EvaluationEventRef | null;
  completionType: NextReplyCompletionType | null;
}
