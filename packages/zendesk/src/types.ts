/**
 * Minimal shapes for the Zendesk REST API fields this adapter actually reads.
 * Not full API coverage — extend as the normalizer (roadmap step 3) needs
 * more fields.
 */

export interface ZendeskCredentials {
  subdomain: string;
  accessToken: string;
  tokenType: string;
  scope: string;
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
  [key: string]: unknown;
}

export interface ZendeskIncrementalTicketExport {
  tickets: ZendeskTicket[];
  end_time: number;
  next_page: string | null;
  count: number;
}

export interface ZendeskAudit {
  id: number;
  ticket_id: number;
  created_at: string;
  author_id: number;
  events: unknown[];
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

export interface ZendeskSlaPolicy {
  id: number;
  title: string;
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
