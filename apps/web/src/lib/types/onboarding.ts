import type { IntegrationConfigStatus } from "./integrations";

export interface ProviderOnboardingStatus {
  connected: boolean;
  backfillComplete: boolean;
  reauthRequired: boolean;
}

export interface OnboardingStatus {
  zendesk: ProviderOnboardingStatus;
  jira: ProviderOnboardingStatus;
  /** Whether this org has saved its own OAuth app config for each provider yet — gates the connect UI (W4). */
  zendeskConfig: IntegrationConfigStatus;
  jiraConfig: IntegrationConfigStatus;
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
