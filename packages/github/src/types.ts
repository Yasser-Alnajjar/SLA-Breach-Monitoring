/**
 * Minimal shapes for the fields this adapter actually reads off GitHub's
 * GraphQL API (https://api.github.com/graphql). Not full schema coverage —
 * extend as the normalizer and correlator need more.
 */

/** The OAuth token portion returned by GitHub's token endpoint. */
export interface GithubTokenCredentials {
  accessToken: string;
  tokenType: string;
  /** Empty for a GitHub App token (permissions come from the App); `repo` for a legacy OAuth App token. */
  scope: string;
  /** Present only when the GitHub App expires user tokens. Single-use: rotated on every refresh. */
  refreshToken?: string;
  /** Epoch ms. Absent means the token does not expire. */
  expiresAt?: number;
  /** Set when a request 401s and there is no refresh path. Cleared automatically on reconnect. */
  reauthRequired?: boolean;
}

/**
 * What's actually stored in Integration.credentials: the OAuth token plus
 * the single repo this integration is scoped to. A GitHub App can be
 * installed on many repositories and has no single "workspace" the way a
 * Jira Cloud site or Linear workspace does, so the org picks one repo
 * explicitly at connect time, the same way Zendesk's subdomain is entered
 * before its OAuth redirect.
 *
 * Tokens from a GitHub App that expires user tokens need Jira-style refreshing
 * (see tokenLifecycle.ts). Non-expiring tokens, including legacy OAuth App
 * tokens, have no `expiresAt` and are never refreshed.
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
