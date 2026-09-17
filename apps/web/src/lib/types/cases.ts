import type {
  ClockState,
  CommitmentKind,
  CommitmentStatus,
  EngineeringLegEvaluation,
  Leg,
  LegSpan,
  NormalizedEventType,
  NormalizedState,
  PausedInterval,
  SLAPolicyMatch,
  WeeklyWindow,
} from "@sla/core";

export interface CommitmentDetail {
  id: string;
  kind: CommitmentKind;
  status: CommitmentStatus;
  startedAt: string;
  targetMinutes: number;
  closedAt: string | null;
  elapsedSeconds: number;
  remainingSeconds: number;
  breachedBySeconds: number | null;
  /** The SLA clock at `asOf`, from the same evaluation as the numbers above. */
  clockState: ClockState;
  pausedSince: string | null;
  /**
   * The pause-aware deadline (or breach instant) from `evaluateCommitment`;
   * null while paused before the target, since no due time is knowable
   * then. The stored `Commitment.dueAt` is deliberately not exposed here:
   * it is a nominal startedAt + target that ignores pauses.
   */
  effectiveDueAt: string | null;
  /**
   * The states that pause this commitment's clock (`pauseStatesFor`) — not
   * the policy version's configured `pauseOnStates`, which not every kind
   * honors (first response never pauses).
   */
  pauseOnStates: NormalizedState[];
  policyVersion: {
    id: string;
    version: number;
    match: SLAPolicyMatch;
    warnAtPercent: number[];
    effectiveFrom: string;
  };
  calendar: {
    id: string;
    version: number;
    timezone: string;
    weekly: WeeklyWindow[];
    holidays: string[];
    alwaysOpen: boolean;
  };
}

export interface CaseLinkDetail {
  system: "zendesk" | "jira" | "linear" | "github";
  externalId: string;
  url: string | null;
  method: string;
  confidence: string;
  statusName: string | null;
}

export interface TimelineEventDetail {
  id: string;
  occurredAt: string;
  actor: string;
  system: string;
  type: NormalizedEventType;
  fromState: NormalizedState | null;
  toState: NormalizedState | null;
}

export interface LegTotal {
  leg: Leg;
  minutes: number;
}

export interface CaseListRow {
  caseId: string;
  externalId: string;
  subject: string | null;
  customerName: string | null;
  priority: string | null;
  tier: string | null;
  channel: string | null;
  openedAt: string;
  closedAt: string | null;
  /** Worst-precedence status across the case's commitments, or null if it has none. */
  worstCommitmentStatus: CommitmentStatus | null;
}

export interface CaseListData {
  asOf: string;
  cases: CaseListRow[];
}

export interface CaseDetailData {
  asOf: string;
  case: {
    id: string;
    externalId: string;
    subject: string | null;
    priority: string | null;
    tier: string | null;
    channel: string | null;
    openedAt: string;
    closedAt: string | null;
    customerName: string | null;
    /** Which ticket source created this case. */
    system: "zendesk" | "jira" | "linear" | "intercom" | "github";
    /** Outbound link to the source ticket (Zendesk ticket or Intercom conversation), when buildable. */
    ticketUrl: string | null;
  };
  currentLeg: Leg;
  commitments: CommitmentDetail[];
  legSpans: (LegSpan & { endedAt: string })[];
  legTotals: LegTotal[];
  engineeringLegTarget: EngineeringLegEvaluation | null;
  runningIntervals: { start: string; end: string }[];
  pausedIntervals: PausedInterval[];
  timeline: TimelineEventDetail[];
  links: CaseLinkDetail[];
}
