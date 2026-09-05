/**
 * Minimal shapes for the Zendesk REST API fields this adapter actually reads.
 * Not full API coverage — extend as the normalizer (roadmap step 3) needs
 * more fields.
 */

export interface ZendeskCredentials {
  subdomain: string;
  accessToken: string;
  /** Absent for integrations connected before refresh support, or if the Zendesk OAuth client has no refresh token configured. */
  refreshToken?: string;
  tokenType: string;
  scope: string;
  /** Epoch ms. Absent means the access token does not expire (legacy client, or token expiration disabled on the Zendesk OAuth client). */
  expiresAt?: number;
  /** Epoch ms. Absent means unknown. */
  refreshTokenExpiresAt?: number;
  /** Set when a refresh attempt fails because the refresh token itself is invalid/expired/revoked. Cleared automatically on reconnect. */
  reauthRequired?: boolean;
}

export interface ZendeskTicket {
  id: number;
  url: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  priority: string | null;
  organization_id: number | null;
  requester_id?: number | null;
  via?: { channel: string };
  [key: string]: unknown;
}

export interface ZendeskIncrementalTicketExport {
  tickets: ZendeskTicket[];
  end_time: number;
  next_page: string | null;
  count: number;
}

/**
 * One entry in an audit's `events` array. Zendesk emits many event `type`s
 * (Comment, Notification, Rating, …) — the normalizer only reads `Change`
 * events on the `status` field.
 */
export interface ZendeskAuditEvent {
  id: number;
  type: string;
  field_name?: string;
  value?: unknown;
  previous_value?: unknown;
  [key: string]: unknown;
}

export interface ZendeskAudit {
  id: number;
  ticket_id: number;
  created_at: string;
  author_id: number;
  via?: { channel: string };
  events: ZendeskAuditEvent[];
  [key: string]: unknown;
}

export interface ZendeskAuditsPage {
  audits: ZendeskAudit[];
  next_page: string | null;
}

export interface ZendeskOrganization {
  id: number;
  name: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ZendeskIncrementalOrganizationExport {
  organizations: ZendeskOrganization[];
  end_time: number;
  next_page: string | null;
  count: number;
}

/**
 * One condition in an SLA policy's `filter`. `field` covers Zendesk's full
 * condition vocabulary (priority, group_id, tags, form_id, ...); the
 * importer (roadmap step 6) only understands a subset — see
 * `SUPPORTED_CONDITION_FIELDS` in ./policies.
 */
export interface ZendeskSlaPolicyCondition {
  field: string;
  operator: string;
  value: string | number | null;
}

export interface ZendeskSlaPolicyFilter {
  all?: ZendeskSlaPolicyCondition[];
  any?: ZendeskSlaPolicyCondition[];
}

/**
 * One (priority, metric) target row. Zendesk lets a single policy define
 * different targets per ticket priority — `priority: null` means the target
 * applies regardless of priority. `metric` is Zendesk's full metric
 * vocabulary (first_reply_time, next_reply_time, requester_wait_time,
 * agent_work_time, periodic_update_time, resolution_time); only
 * `first_reply_time`/`resolution_time` map to a `CommitmentKind` we track.
 */
export interface ZendeskSlaPolicyMetric {
  priority: string | null;
  metric: string;
  target: number; // minutes
  business_hours: boolean;
}

export interface ZendeskSlaPolicy {
  id: number;
  title: string;
  filter?: ZendeskSlaPolicyFilter;
  policy_metrics?: ZendeskSlaPolicyMetric[];
  [key: string]: unknown;
}

export interface ZendeskSlaPoliciesPage {
  sla_policies: ZendeskSlaPolicy[];
  next_page: string | null;
}

/**
 * Persisted in Integration.cursor. Resumable across backfill runs: each
 * `startTime` is the Zendesk incremental-export watermark for that stream,
 * advanced only after a page's tickets/organizations (and, for tickets,
 * their audits) have been written as RawEvents.
 */
export interface ZendeskCursor {
  tickets?: { startTime: number };
  organizations?: { startTime: number };
  backfillCompletedAt?: string; // ISO 8601
}
