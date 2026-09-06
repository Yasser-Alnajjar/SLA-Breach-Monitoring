import type {
  LinearAttachment,
  LinearAttachmentConnection,
  LinearCredentials,
  LinearHistoryConnection,
  LinearHistoryEntry,
  LinearIssueConnection,
  LinearPageInfo,
} from "./types";

const API_URL = "https://api.linear.app/graphql";
const PAGE_SIZE = 100;

export class LinearApiError extends Error {
  readonly status: number;
  readonly errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.name = "LinearApiError";
    this.status = status;
    this.errors = errors;
  }
}

export interface LinearClientOptions {
  /**
   * Called at most once per request when Linear responds 401. Receives the
   * credentials that were just rejected (so the caller can tell whether
   * another process already rotated them) and must return credentials to
   * retry with. Throwing here (e.g. a reauth-required error) aborts the retry.
   */
  onUnauthorized?: (failedCredentials: LinearCredentials) => Promise<LinearCredentials>;
}

const ISSUES_QUERY = `
  query Issues($after: String, $updatedSince: DateTimeOrDuration!) {
    issues(
      first: ${PAGE_SIZE}
      after: $after
      orderBy: updatedAt
      filter: { updatedAt: { gte: $updatedSince } }
    ) {
      nodes {
        id
        identifier
        title
        url
        priority
        createdAt
        updatedAt
        state { id name type }
        team { id key name }
        creator { id name }
        assignee { id name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ISSUE_HISTORY_QUERY = `
  query IssueHistory($issueId: String!, $after: String) {
    issue(id: $issueId) {
      history(first: ${PAGE_SIZE}, after: $after) {
        nodes {
          id
          createdAt
          actor { id name }
          fromState { id name type }
          toState { id name type }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ISSUE_ATTACHMENTS_QUERY = `
  query IssueAttachments($issueId: String!, $after: String) {
    issue(id: $issueId) {
      attachments(first: ${PAGE_SIZE}, after: $after) {
        nodes {
          id
          url
          title
          subtitle
          sourceType
          createdAt
          updatedAt
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function emptyConnection<T>(): { nodes: T[]; pageInfo: LinearPageInfo } {
  return { nodes: [], pageInfo: { hasNextPage: false } };
}

/** Thin, provider-aware GraphQL client. Everything past this file is provider-agnostic. */
export class LinearClient {
  private credentials: LinearCredentials;
  private readonly onUnauthorized?: (failedCredentials: LinearCredentials) => Promise<LinearCredentials>;

  constructor(credentials: LinearCredentials, options: LinearClientOptions = {}) {
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

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "5");
      await sleep(retryAfterSeconds * 1000);
      return this.request<T>(query, variables, hasRetriedAuth);
    }

    if (response.status === 401 && this.onUnauthorized && !hasRetriedAuth) {
      this.credentials = await this.onUnauthorized(this.credentials);
      return this.request<T>(query, variables, true);
    }

    if (!response.ok) {
      throw new LinearApiError(response.status, `Linear API error ${response.status}`);
    }

    const body = (await response.json()) as { data?: T; errors?: unknown };
    if (body.errors) {
      throw new LinearApiError(response.status, "Linear GraphQL query returned errors", body.errors);
    }
    return body.data as T;
  }

  async searchIssues(updatedSince: string, after?: string): Promise<LinearIssueConnection> {
    const data = await this.request<{ issues: LinearIssueConnection }>(ISSUES_QUERY, { updatedSince, after });
    return data.issues;
  }

  async fetchIssueHistory(issueId: string, after?: string): Promise<LinearHistoryConnection> {
    const data = await this.request<{ issue: { history: LinearHistoryConnection } | null }>(ISSUE_HISTORY_QUERY, {
      issueId,
      after,
    });
    return data.issue?.history ?? emptyConnection<LinearHistoryEntry>();
  }

  async fetchIssueAttachments(issueId: string, after?: string): Promise<LinearAttachmentConnection> {
    const data = await this.request<{ issue: { attachments: LinearAttachmentConnection } | null }>(
      ISSUE_ATTACHMENTS_QUERY,
      { issueId, after },
    );
    return data.issue?.attachments ?? emptyConnection<LinearAttachment>();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
