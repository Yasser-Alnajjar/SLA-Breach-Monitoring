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
  /**
   * Which cycle of `kind` this commitment covers (`Commitment.cycleKey`):
   * `"single"` for first_response/resolution, a Next Reply cycle's own stable
   * key otherwise — a case can have several `next_reply` commitments at
   * once, and this is what tells them apart. Opaque; not a display label.
   */
  cycleKey: string;
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

/**
 * One public message in the case's conversation — an `agent_replied` or
 * `customer_replied` `NormalizedEvent` with its source text attached. Never
 * built from an inference on a name or email: `actor` is carried straight
 * through from the already-resolved `NormalizedEvent.actor` (Zendesk role /
 * Intercom author type), the same field the SLA engine itself trusts.
 *
 * Excludes private/internal notes: they are never derived into
 * `NormalizedEvent` in the first place (see `isPublicCommentEvent` in
 * @sla/zendesk and `isVisibleMessagePart` in @sla/intercom), so there is no
 * normalized record of them to surface here yet.
 */
export interface ConversationMessageDetail {
  /** The source `NormalizedEvent.id` — stable within one render, not across normalization re-runs. */
  id: string;
  occurredAt: string;
  actor: "customer" | "agent";
  type: "agent_replied" | "customer_replied";
  /**
   * The message's own author name, when the source system carries one
   * (Intercom always does; Zendesk only when the author is provably the
   * case's requester — Zendesk otherwise never persists a comment author's
   * name, only their role). Null falls back to a generic "Customer"/"Agent"
   * label in the UI — never guessed from an email or the case's requester
   * name when that link can't be confirmed.
   */
  authorName: string | null;
  /** Plain text, safe to render without HTML interpretation. */
  body: string;
}

export interface LegTotal {
  leg: Leg;
  minutes: number;
}

export interface CaseListRow {
  caseId: string;
  externalId: string;
  subject: string | null;
  /** The case's account/company (Zendesk Organization / Intercom Company), or null when the ticket has none. Never falls back to `requesterName` — a requester is not a customer. */
  customerName: string | null;
  /** The individual who submitted the ticket (e.g. a Zendesk ticket's requester), or null when unknown. Independent of `customerName` — never merged with it. */
  requesterName: string | null;
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
    /** The case's account/company (Zendesk Organization / Intercom Company), or null when the ticket has none. Never falls back to `requesterName` — a requester is not a customer. */
    customerName: string | null;
    /** The individual who submitted the ticket (e.g. a Zendesk ticket's requester), or null when unknown. Independent of `customerName` — never merged with it. */
    requesterName: string | null;
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
  /** Every public customer/agent message, in the same deterministic order as `timeline` — see `ConversationMessageDetail`. */
  conversation: ConversationMessageDetail[];
  links: CaseLinkDetail[];
}
