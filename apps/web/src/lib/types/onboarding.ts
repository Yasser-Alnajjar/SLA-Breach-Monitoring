export interface ProviderOnboardingStatus {
  connected: boolean;
  backfillComplete: boolean;
  reauthRequired: boolean;
}

export interface OnboardingStatus {
  zendesk: ProviderOnboardingStatus;
  jira: ProviderOnboardingStatus;
  /** Raw ticket snapshots landed so far — ticks up while backfill is in flight. */
  ticketsFetched: number;
  /** Cases with at least one Jira case link. */
  escalatedCases: number;
  /** Jira case-link rows (a case can in principle hold more than one). */
  linkedIssues: number;
}

export interface OnboardingPageData {
  status: OnboardingStatus;
  zendeskSubdomain: string | null;
}
