/**
 * Minimal shapes for the Jira Cloud REST API (v3) fields this adapter
 * actually reads. Not full API coverage — extend as the normalizer and
 * correlator (roadmap step 5) need more fields.
 */

/**
 * A Jira Cloud site is identified by its `cloudId`, resolved once at connect
 * time via the accessible-resources endpoint. v1 assumes one Jira site per
 * organization — the first accessible resource is used.
 */
export interface JiraCredentials {
  cloudId: string;
  siteUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
}

export interface JiraAccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: { id: string; name: string; statusCategory?: { key: string } };
    priority: { id: string; name: string } | null;
    project: { id: string; key: string; name: string };
    created: string;
    updated: string;
    reporter: { accountId: string; displayName?: string } | null;
    assignee: { accountId: string; displayName?: string } | null;
    [key: string]: unknown;
  };
}

export interface JiraSearchPage {
  issues: JiraIssue[];
  startAt: number;
  maxResults: number;
  total: number;
}

/**
 * One entry in an issue's changelog — Jira's immutable history log. Each
 * history id occurs exactly once, ever, so no hash suffix is needed for
 * dedup. `items` holds one row per field changed in that history entry; the
 * normalizer only reads items where `field === "status"`.
 */
export interface JiraChangelogHistory {
  id: string;
  author: { accountId: string; displayName?: string } | null;
  created: string;
  items: Array<{
    field: string;
    fieldtype: string;
    from: string | null;
    fromString: string | null;
    to: string | null;
    toString: string | null;
  }>;
}

export interface JiraChangelogPage {
  values: JiraChangelogHistory[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
}

/**
 * Populated by the official Zendesk↔Jira integration or manually by a user.
 * `object.url` pointing at a Zendesk ticket is the deterministic correlation
 * signal the roadmap step 5 correlator reads (Phase 15).
 */
export interface JiraRemoteLink {
  id: number;
  self: string;
  globalId?: string;
  relationship?: string;
  object: {
    url: string;
    title: string;
    [key: string]: unknown;
  };
}

/**
 * Persisted in Integration.cursor. Resumable across backfill runs, mirroring
 * ZendeskCursor: `updatedSince` is the JQL watermark for the issue stream,
 * `startAt` resumes mid-page within that watermark, and both advance only
 * after a page's issues (and their changelogs/remote links) have been
 * written as RawEvents.
 */
export interface JiraCursor {
  issues?: { updatedSince: string /* ISO 8601 */; startAt: number };
  backfillCompletedAt?: string; // ISO 8601
}
