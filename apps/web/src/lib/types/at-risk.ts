import { Leg, CommitmentKind, CommitmentStatus } from "@sla/core";

export interface AtRiskRowData {
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
