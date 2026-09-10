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

export type SourceSystem = "zendesk" | "jira" | "linear";

export type NormalizedEventType =
  | "case_created"
  | "state_changed"
  | "issue_linked"
  | "issue_unlinked"
  | "case_closed";

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
  dueAt: string; // ISO 8601
  status: CommitmentStatus;
  closedAt?: string;
}

export interface Evaluation {
  id: string;
  commitmentId: string;
  evaluatedAt: string; // ISO 8601
  elapsedWorkingMinutes: number;
  remainingMinutes: number;
  status: CommitmentStatus;
  breachedByMinutes?: number;
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
    lastEventId: string | null;
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

export interface ElapsedResult {
  elapsedWorkingMinutes: number;
  pausedIntervals: PausedInterval[];
}
