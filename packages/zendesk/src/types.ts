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
  subject: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  priority: string | null;
  organization_id: number | null;
  requester_id?: number | null;
  /** Ticket tags, used as a generic SLA policy match input (`match.conditions`, field `"tags"` — see `extractMatchFromFilter` in ./policies). Absent on very old snapshots fetched before this field was read. */
  tags?: string[];
  via?: { channel: string };
  /**
   * Not a real Zendesk API field — resolved from the `users` sideload
   * (`include=users`) and embedded onto the ticket snapshot before it's
   * persisted as a RawEvent (see `mapTicketToRawEvent`), so the normalizer
   * can read the requester's display name straight off the ticket without a
   * separate RawEvent stream. Null when the ticket has no requester or the
   * requester wasn't present in the sideload.
   */
  requester_name?: string | null;
  [key: string]: unknown;
}

export interface ZendeskIncrementalTicketExport {
  tickets: ZendeskTicket[];
  end_time: number;
  next_page: string | null;
  count: number;
  /** Sideloaded via `include=users` (see `ZendeskClient.fetchTicketsPage`): every user referenced by a ticket in this page (requesters, assignees, ...), deduplicated by Zendesk. */
  users?: ZendeskUser[];
}

/**
 * One entry in an audit's `events` array. Zendesk emits many event `type`s
 * (Comment, Notification, Rating, …) — the normalizer only reads `Change`
 * events on the `status` field and public `Comment` events.
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

/**
 * A Zendesk user's account role — what actually tells an agent's comment
 * from a customer's. Ticket relationships (requester, assignee) don't: an
 * agent can be a ticket's requester.
 */
export type ZendeskUserRole = "end-user" | "agent" | "admin";

export interface ZendeskUser {
  id: number;
  role: ZendeskUserRole;
  /** Present on the `users` sideload (`include=users`); not read from the audits sideload, which only ever asks for `role` (see `mapUserToRawEvent`'s privacy-minimization comment). */
  name?: string;
  [key: string]: unknown;
}

export interface ZendeskAuditsPage {
  audits: ZendeskAudit[];
  /** Sideloaded via `include=users` (see `ZendeskClient.fetchTicketAuditsPage`): the audits' authors, with their roles. */
  users?: ZendeskUser[];
  next_page: string | null;
}

export interface ZendeskTicketShow {
  ticket: ZendeskTicket;
  /** Sideloaded via `include=users` (see `ZendeskClient.fetchTicket`): every user referenced by this ticket (requester, assignee, ...). */
  users?: ZendeskUser[];
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
 * condition vocabulary (priority, group_id, tags, form_id, ...) — the
 * importer (`extractMatchFromFilter` in ./policies) preserves every field
 * generically, but a condition only ever matches a case whose attributes
 * actually carry that field (priority, organization/customerIds, tags today);
 * anything else always evaluates to "does not match" (see `evaluateCondition`,
 * packages/core), never to "unrestricted".
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
 * agent_work_time, periodic_update_time, total_resolution_time); only
 * `first_reply_time`/`total_resolution_time`/`next_reply_time` map to a
 * `CommitmentKind` we track (see `METRIC_TO_COMMITMENT_KIND` in ./policies).
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
  /**
   * The business hours schedule this policy's `business_hours` metrics are
   * measured against (Zendesk's Multiple Schedules feature). Null/absent
   * means the account's metrics run on calendar time, or on a single
   * account-wide schedule that isn't independently selectable per policy —
   * either way there's no specific schedule to import a calendar for.
   */
  schedule_id?: number | null;
  /**
   * Zendesk's own evaluation order for this policy relative to every other
   * policy on the account — lower matches first (D6). Absent on very old
   * accounts/snapshots fetched before this field was read; `position` on the
   * imported `SLAPolicy` is then left `null` and falls back to specificity
   * (`matchPolicyVersion`, packages/core).
   */
  position?: number;
  [key: string]: unknown;
}

export interface ZendeskSlaPoliciesPage {
  sla_policies: ZendeskSlaPolicy[];
  next_page: string | null;
}

/**
 * One open window, expressed as minutes since Sunday 00:00 in the
 * schedule's own timezone — a flat weekly offset rather than a per-day
 * (day, openMinute, closeMinute) triple. Assumed to fall within a single
 * day; Zendesk does not emit an interval spanning midnight.
 */
export interface ZendeskBusinessHoursInterval {
  start_time: number;
  end_time: number;
}

export interface ZendeskBusinessHoursSchedule {
  id: number;
  name: string;
  time_zone: string;
  intervals: ZendeskBusinessHoursInterval[];
  [key: string]: unknown;
}

export interface ZendeskBusinessHoursSchedulesPage {
  schedules: ZendeskBusinessHoursSchedule[];
}

/** `start_date`/`end_date` are "YYYY-MM-DD", inclusive of both endpoints. */
export interface ZendeskScheduleHoliday {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
}

export interface ZendeskScheduleHolidaysPage {
  holidays: ZendeskScheduleHoliday[];
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
