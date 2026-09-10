import type {
  ConfigurableIntegrationProvider,
  IntegrationConfigStatus,
} from "@sla/db";
import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";
import type { SlackChannel } from "@sla/slack";
import type { BackfillResult as JiraBackfillResult } from "@sla/jira";
import type { BackfillResult as LinearBackfillResult } from "@sla/linear";
import type {
  BackfillResult as ZendeskBackfillResult,
  NormalizationResult,
} from "@sla/zendesk";

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

/**
 * Narrow, display-only view of one Zendesk/Jira/Linear `Integration` row for
 * a client component — never the row itself. `connected` means "has live
 * credentials" (true for `connected` and `reauth_required` status, false for
 * `disconnected` or no row); `connectedAt`/`disconnectedAt` stay populated
 * across a disconnect so the UI can still show "Disconnected {date}."
 */
export interface IntegrationConnectionView {
  connected: boolean;
  reauthRequired: boolean;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
}

export interface ZendeskConnectionView extends IntegrationConnectionView {
  subdomain: string | null;
}

/** Narrow, display-only view of `SlackIntegration` — never the row itself (it carries a bot access token). */
export interface SlackConnectionView {
  connected: boolean;
  teamName: string | null;
  channelId: string | null;
  channelName: string | null;
  installedAt: Date | null;
}

export interface IntegrationsPageData {
  zendesk: ZendeskConnectionView;
  jira: IntegrationConnectionView;
  linear: IntegrationConnectionView;
  linearConfig: IntegrationConfigStatus;
  slack: SlackConnectionView;
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

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  "zendesk",
  "jira",
  "linear",
];

export function isIntegrationProvider(
  value: string,
): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as string[]).includes(value);
}

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> =
  {
    zendesk: "Zendesk",
    jira: "Jira",
    linear: "Linear",
  };

/**
 * Read model for `/settings/integrations/[provider]` (roadmap step 20
 * follow-up): everything beyond connect/disconnect for one already-connected
 * integration — backfill and, for Zendesk/Jira, the real-time webhook setup.
 * Display-only scalars derived server-side from the `Integration` row and its
 * JSON `credentials`/`cursor` — neither ever reaches the client directly.
 * `webhookSecret` is the one exception to "no secrets to the client": it's
 * intentionally user-visible, see `WebhookInfo`.
 */
export interface IntegrationDetailData {
  provider: IntegrationProvider;
  integrationId: string;
  connectedAt: Date;
  reauthRequired: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  /** ISO 8601, matching the provider cursor's own `backfillCompletedAt`. */
  backfillCompletedAt: Date | null;
  webhookSecret: string | null;
  /** Zendesk only. */
  subdomain?: string;
}
