import type { CommitmentKind, CommitmentStatus, EngineeringLegEvaluation, Leg } from "@sla/core";

export interface AtRiskRow {
  commitmentId: string;
  caseId: string;
  externalId: string;
  subject: string | null;
  customerName: string | null;
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
  caseId: string;
  externalId: string;
  customerName: string | null;
  kind: CommitmentKind;
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
}
