/**
 * Minimal shapes for the fields this adapter actually reads off GitHub's
 * GraphQL API (https://api.github.com/graphql). Not full schema coverage —
 * extend as the normalizer and correlator need more.
 */

/** The OAuth token portion returned by GitHub's token endpoint. */
export interface GithubTokenCredentials {
  accessToken: string;
  tokenType: string;
  scope: string;
  /** Set when a request 401s and there is no refresh path. Cleared automatically on reconnect. */
  reauthRequired?: boolean;
}

/**
 * What's actually stored in Integration.credentials: the OAuth token plus
 * the single repo this integration is scoped to. GitHub OAuth Apps have no
 * single "workspace" the way a Jira Cloud site or Linear workspace does — a
 * `repo`-scoped token can see every repo the authorizing user can access —
 * so the org picks one repo explicitly at connect time, the same way
 * Zendesk's subdomain is entered before its OAuth redirect.
 *
 * GitHub's OAuth App access tokens, like Linear's, carry no refresh token
 * and do not expire — unlike Jira's 3-legged refresh flow, there is no
 * expiry/refresh dance to manage here.
 */
export interface GithubCredentials extends GithubTokenCredentials {
  owner: string;
  repo: string;
}

export interface GithubActor {
  login: string;
}

export interface GithubPullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  /** GitHub's own fixed vocabulary — a merged PR is `state: "MERGED"`, not `"CLOSED"` + a flag read elsewhere. */
  state: "OPEN" | "CLOSED" | "MERGED";
  merged: boolean;
  headRefName: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: GithubActor | null;
}

export interface GithubPageInfo {
  hasNextPage: boolean;
  endCursor?: string;
}

export interface GithubPullRequestConnection {
  nodes: GithubPullRequest[];
  pageInfo: GithubPageInfo;
}

/**
 * GitHub's fixed-vocabulary PR timeline event types this adapter reads — the
 * PR lifecycle's changelog analog, mirroring Jira's changelog / Linear's
 * issue history. `actor` is normalized to one field name at query time
 * regardless of which underlying GraphQL field it came from
 * (`PullRequestReview` exposes `author`, not `actor` — aliased in the query
 * in client.ts), so every item type is handled uniformly downstream.
 */
export type GithubTimelineItemType =
  | "ReadyForReviewEvent"
  | "ReviewRequestedEvent"
  | "PullRequestReview"
  | "MergedEvent"
  | "ClosedEvent"
  | "ReopenedEvent";

export interface GithubTimelineItem {
  __typename: GithubTimelineItemType;
  id: string;
  createdAt: string;
  actor: GithubActor | null;
}

export interface GithubTimelineConnection {
  nodes: GithubTimelineItem[];
  pageInfo: GithubPageInfo;
}

/**
 * Persisted in Integration.cursor. Resumable across backfill runs, mirroring
 * LinearCursor/JiraCursor: `updatedSince` is the watermark for the pull
 * request stream, `after` resumes mid-page within that watermark via
 * GitHub's opaque cursor pagination, and both advance only after a page's
 * pull requests (and their timelines) have been written as RawEvents.
 * Absent `after` means "start of this watermark's result set."
 */
export interface GithubCursor {
  pullRequests?: { updatedSince: string /* ISO 8601 */; after?: string };
  backfillCompletedAt?: string; // ISO 8601
}
