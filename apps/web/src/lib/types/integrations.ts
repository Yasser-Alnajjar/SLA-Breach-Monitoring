import type { Integration, SlackIntegration } from "@sla/db";
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
  engineeringLegTargetMinutes: number | null;
  slaPolicies: SlaPolicySummary[];
}

export interface ZendeskSyncResult {
  backfill: ZendeskBackfillResult;
  normalization: NormalizationResult;
}

export type { SlackChannel, JiraBackfillResult, LinearBackfillResult };

export type IntegrationProvider = "zendesk" | "jira" | "linear";
