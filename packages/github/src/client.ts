import type {
  GithubCredentials,
  GithubPageInfo,
  GithubPullRequest,
  GithubPullRequestConnection,
  GithubTimelineConnection,
  GithubTimelineItem,
} from "./types";

const API_URL = "https://api.github.com/graphql";
const PAGE_SIZE = 100;

export class GithubApiError extends Error {
  readonly status: number;
  readonly errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
    this.errors = errors;
  }
}

export interface GithubClientOptions {
  /**
   * Called at most once per request when GitHub responds 401. Receives the
   * credentials that were just rejected (so the caller can tell whether
   * another process already rotated them) and must return credentials to
   * retry with. Throwing here (e.g. a reauth-required error) aborts the retry.
   */
  onUnauthorized?: (failedCredentials: GithubCredentials) => Promise<GithubCredentials>;
}

const SEARCH_PULL_REQUESTS_QUERY = `
  query SearchPullRequests($query: String!, $after: String) {
    search(query: $query, type: ISSUE, first: ${PAGE_SIZE}, after: $after) {
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          state
          merged
          headRefName
          createdAt
          updatedAt
          mergedAt
          closedAt
          author { login }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PULL_REQUEST_TIMELINE_QUERY = `
  query PullRequestTimeline($id: ID!, $after: String) {
    node(id: $id) {
      ... on PullRequest {
        timelineItems(
          first: ${PAGE_SIZE}
          after: $after
          itemTypes: [READY_FOR_REVIEW_EVENT, REVIEW_REQUESTED_EVENT, PULL_REQUEST_REVIEW, MERGED_EVENT, CLOSED_EVENT, REOPENED_EVENT]
        ) {
          nodes {
            __typename
            ... on ReadyForReviewEvent { id createdAt actor { login } }
            ... on ReviewRequestedEvent { id createdAt actor { login } }
            ... on PullRequestReview { id createdAt actor: author { login } }
            ... on MergedEvent { id createdAt actor { login } }
            ... on ClosedEvent { id createdAt actor { login } }
            ... on ReopenedEvent { id createdAt actor { login } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

function emptyConnection<T>(): { nodes: T[]; pageInfo: GithubPageInfo } {
  return { nodes: [], pageInfo: { hasNextPage: false } };
}

/** Thin, provider-aware GraphQL client. Everything past this file is provider-agnostic. */
export class GithubClient {
  private credentials: GithubCredentials;
  private readonly onUnauthorized?: (failedCredentials: GithubCredentials) => Promise<GithubCredentials>;

  constructor(credentials: GithubCredentials, options: GithubClientOptions = {}) {
    this.credentials = credentials;
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(
    query: string,
    variables: Record<string, unknown>,
    hasRetriedAuth = false,
  ): Promise<T> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    // GitHub's secondary rate limits surface as 403 with a Retry-After
    // header, unlike Linear's plain 429 — a normal 403 (e.g. insufficient
    // scope) carries no such header and falls through to the error below.
    if (response.status === 403 && response.headers.has("Retry-After")) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "60");
      await sleep(retryAfterSeconds * 1000);
      return this.request<T>(query, variables, hasRetriedAuth);
    }

    if (response.status === 401 && this.onUnauthorized && !hasRetriedAuth) {
      this.credentials = await this.onUnauthorized(this.credentials);
      return this.request<T>(query, variables, true);
    }

    if (!response.ok) {
      throw new GithubApiError(response.status, `GitHub API error ${response.status}`);
    }

    const body = (await response.json()) as { data?: T; errors?: unknown };
    if (body.errors) {
      throw new GithubApiError(response.status, "GitHub GraphQL query returned errors", body.errors);
    }
    return body.data as T;
  }

  /**
   * GitHub's `pullRequests` connection has no native "since" filter (unlike
   * Linear's plain `updatedAt` argument), so this goes through the `search`
   * API instead — closer to Jira's JQL-windowed-search shape. Note: GitHub's
   * `updated:>=` search qualifier is date-granularity, not full ISO
   * datetime, so a watermark can re-walk part of the same day on the next
   * run — harmless, since writes dedupe via `skipDuplicates`.
   */
  async searchPullRequests(
    owner: string,
    repo: string,
    updatedSince: string,
    after?: string,
  ): Promise<GithubPullRequestConnection> {
    const sinceDate = updatedSince.slice(0, 10);
    const query = `repo:${owner}/${repo} is:pr updated:>=${sinceDate}`;
    const data = await this.request<{
      search: { nodes: (GithubPullRequest | Record<string, never>)[]; pageInfo: GithubPageInfo };
    }>(SEARCH_PULL_REQUESTS_QUERY, { query, after });

    return {
      // Non-PR search results would come back as an empty object from the
      // `... on PullRequest` fragment — filtered out, though `is:pr` in the
      // query string means this should never actually happen in practice.
      nodes: data.search.nodes.filter(
        (node): node is GithubPullRequest => typeof (node as GithubPullRequest).id === "string",
      ),
      pageInfo: data.search.pageInfo,
    };
  }

  async fetchTimelineItems(pullRequestId: string, after?: string): Promise<GithubTimelineConnection> {
    const data = await this.request<{ node: { timelineItems: GithubTimelineConnection } | null }>(
      PULL_REQUEST_TIMELINE_QUERY,
      { id: pullRequestId, after },
    );
    return data.node?.timelineItems ?? emptyConnection<GithubTimelineItem>();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
