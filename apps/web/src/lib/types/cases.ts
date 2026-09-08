import type {
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
  dueAt: string;
  closedAt: string | null;
  elapsedWorkingMinutes: number;
  remainingMinutes: number;
  breachedByMinutes: number | null;
  policyVersion: {
    id: string;
    version: number;
    match: SLAPolicyMatch;
    warnAtPercent: number[];
    pauseOnStates: NormalizedState[];
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
  system: "zendesk" | "jira" | "linear";
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

export interface CaseDetailData {
  asOf: string;
  case: {
    id: string;
    externalId: string;
    priority: string | null;
    tier: string | null;
    channel: string | null;
    openedAt: string;
    closedAt: string | null;
    customerName: string | null;
    zendeskUrl: string | null;
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
