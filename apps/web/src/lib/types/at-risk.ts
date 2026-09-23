import { Leg, CommitmentKind, CommitmentStatus } from "@sla/core";

/**
 * A case's linked Jira/Linear/GitHub issue as surfaced to this row — only
 * ever built from an active (`unlinkedAt: null`) `CaseLink`, preferring
 * `certain` confidence when a case somehow carries more than one.
 */
export interface AtRiskLinkedIssue {
  system: "jira" | "linear" | "github";
  externalId: string;
  confidence: "certain" | "probable";
}

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
  /** The source ticket's priority (Zendesk/Intercom), or null when unset. */
  priority: string | null;
  /** `Customer.tier`, falling back to `Case.tier` for a ticket with no linked customer. */
  tier: string | null;
  /** This commitment's target minutes, from the matched `SLAPolicyVersion` — the "Resolution (4h Max)"-style ceiling. */
  targetMinutes: number;
  /** Business-time seconds elapsed against this commitment's own clock so far (`Evaluation.elapsedSeconds`) — distinct from the leg-wall-clock sums below. */
  elapsedSeconds: number;
  /** Cumulative minutes this case has spent in the support leg so far, via `sumLegMinutes`. */
  supportLegMinutes: number;
  /** Cumulative minutes this case has spent in the engineering leg so far, via `sumLegMinutes`. */
  engineeringLegMinutes: number;
  /** The case's support-side assignee (`Case.assigneeName`), or null when unassigned. */
  supportAssigneeName: string | null;
  /** This case's active Jira/Linear/GitHub correlation, or null when none exists yet. */
  linkedIssue: AtRiskLinkedIssue | null;
}
