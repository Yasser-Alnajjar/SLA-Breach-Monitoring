import type { ConfigurableIntegrationProvider, Integration, IntegrationConfigStatus, SlackIntegration } from "@sla/db";
import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";
import type { ZendeskCredentials, ZendeskCursor } from "@sla/zendesk";
import type { JiraCredentials, JiraCursor } from "@sla/jira";
import type { LinearCredentials, LinearCursor } from "@sla/linear";
import type { SlackChannel } from "@sla/slack";
import type { BackfillResult as JiraBackfillResult } from "@sla/jira";
import type { BackfillResult as LinearBackfillResult } from "@sla/linear";
import type { BackfillResult as ZendeskBackfillResult, NormalizationResult } from "@sla/zendesk";

export interface SlaPolicySummary {
  id: string;
  name: string;
  /** Non-null `SLAPolicy.externalId` means it was imported from Zendesk rather than created manually. */
  imported: boolean;
  version: number;
  effectiveFrom: string;
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
}

export interface IntegrationsPageData {
  zendeskIntegration: Integration | null;
  zendeskCursor: ZendeskCursor | null;
  zendeskCredentials: ZendeskCredentials | null;
  jiraIntegration: Integration | null;
  jiraCursor: JiraCursor | null;
  jiraCredentials: JiraCredentials | null;
  linearIntegration: Integration | null;
  linearCursor: LinearCursor | null;
  linearCredentials: LinearCredentials | null;
  slackIntegration: SlackIntegration | null;
  zendeskConfig: IntegrationConfigStatus;
  jiraConfig: IntegrationConfigStatus;
  slackConfig: IntegrationConfigStatus;
  engineeringLegTargetMinutes: number | null;
  slaPolicies: SlaPolicySummary[];
}

export type { ConfigurableIntegrationProvider, IntegrationConfigStatus };

export interface ZendeskSyncResult {
  backfill: ZendeskBackfillResult;
  normalization: NormalizationResult;
}

export type { SlackChannel, JiraBackfillResult, LinearBackfillResult };

export type IntegrationProvider = "zendesk" | "jira" | "linear";

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = ["zendesk", "jira", "linear"];

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as string[]).includes(value);
}

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  zendesk: "Zendesk",
  jira: "Jira",
  linear: "Linear",
};

/**
 * Read model for `/settings/integrations/[provider]` (roadmap step 20
 * follow-up): everything beyond connect/disconnect for one already-connected
 * integration — backfill and, for Zendesk/Jira, the real-time webhook setup.
 * `credentials`/`cursor` stay loosely typed here the same way the cards on
 * the main integrations page already do; the view casts them per `provider`.
 */
export interface IntegrationDetailData {
  provider: IntegrationProvider;
  integration: Integration;
  credentials: ZendeskCredentials | JiraCredentials | LinearCredentials;
  cursor: ZendeskCursor | JiraCursor | LinearCursor | null;
}
