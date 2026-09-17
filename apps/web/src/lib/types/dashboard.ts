import type {
  CommitmentKind,
  CommitmentStatus,
  EngineeringLegEvaluation,
  Leg,
} from "@sla/core";

export interface AtRiskRow {
  commitmentId: string;
  caseId: string;
  externalId: string;
  subject: string | null;
  /** The case's account/company, or null when the ticket has none. Never falls back to `requesterName` — a requester is not a customer. */
  customerName: string | null;
  /** The individual who submitted the ticket, or null when unknown. Independent of `customerName` — never merged with it. */
  requesterName: string | null;
  kind: CommitmentKind;
  remainingMinutes: number;
  status: CommitmentStatus;
  currentLeg: Leg;
  minutesInCurrentLeg: number;
}

export interface AgingEscalationRow {
  caseId: string;
  externalId: string;
  customerName: string | null;
  minutesInCurrentLeg: number;
  legTarget: EngineeringLegEvaluation | null;
}

export interface BreachedCaseRow {
  commitmentId: string;
  caseId: string;
  externalId: string;
  customerName: string | null;
  kind: CommitmentKind;
  subject: string | null;
}

/** A customer/kind pair whose most recent cycle times statistically depart from their own history (roadmap step 25). */
export interface CycleTimeAnomalyRow {
  customerName: string;
  kind: CommitmentKind;
  baselineMedianMinutes: number;
  baselineCount: number;
  recentMedianMinutes: number;
  recentCount: number;
  modifiedZScore: number;
  direction: "slower" | "faster";
}

/** Distribution of cases by worst commitment status, for the SLA Compliance chart (roadmap: Project Analytics). */
export interface SlaComplianceBreakdown {
  metSla: number;
  atRisk: number;
  breached: number;
  total: number;
}

/** One day's new-breach count for the Breaches Over Time chart. */
export interface BreachesOverTimePoint {
  date: string;
  count: number;
}

/** Breach count for one leg, for the Breaches by Stage chart. */
export interface BreachesByStageRow {
  leg: Leg;
  count: number;
}

export interface ProjectAnalyticsData {
  compliance: SlaComplianceBreakdown;
  breachesOverTime: BreachesOverTimePoint[];
  breachesByStage: BreachesByStageRow[];
}

export interface DashboardData {
  asOf: string;
  periodDays: number;
  atRisk: AtRiskRow[];
  atRiskOverflowCount: number;
  otherOpenCommitments: AtRiskRow[];
  breachedThisPeriod: BreachedCaseRow[];
  agingInEngineering: AgingEscalationRow[];
  agingOverflowCount: number;
  compliance: { current: number | null; previous: number | null };
  cycleTimeAnomalies: CycleTimeAnomalyRow[];
  analytics: ProjectAnalyticsData;
}
