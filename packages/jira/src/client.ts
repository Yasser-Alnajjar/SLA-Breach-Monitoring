import type { JiraChangelogPage, JiraCredentials, JiraRemoteLink, JiraSearchPage, JiraStatus } from "./types";

const SEARCH_PAGE_SIZE = 100;

export class JiraApiError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`Jira API error ${status} for ${url}`);
    this.name = "JiraApiError";
    this.status = status;
  }
}

export interface JiraClientOptions {
  /**
   * Called at most once per request when Jira responds 401. Receives the
   * credentials that were just rejected (so the caller can tell whether
   * another process already rotated them) and must return credentials to
   * retry with. Throwing here (e.g. a reauth-required error) aborts the retry.
   */
  onUnauthorized?: (failedCredentials: JiraCredentials) => Promise<JiraCredentials>;
}

/** Thin, provider-aware fetch wrapper. Everything past this file is provider-agnostic. */
export class JiraClient {
  private credentials: JiraCredentials;
  private readonly onUnauthorized?: (failedCredentials: JiraCredentials) => Promise<JiraCredentials>;

  constructor(credentials: JiraCredentials, options: JiraClientOptions = {}) {
    this.credentials = credentials;
    this.onUnauthorized = options.onUnauthorized;
  }

  private baseUrl(): string {
    return `https://api.atlassian.com/ex/jira/${this.credentials.cloudId}`;
  }

  private async request<T>(path: string, hasRetriedAuth = false): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl()}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "5");
      await sleep(retryAfterSeconds * 1000);
      return this.request<T>(path, hasRetriedAuth);
    }

    if (response.status === 401 && this.onUnauthorized && !hasRetriedAuth) {
      this.credentials = await this.onUnauthorized(this.credentials);
      return this.request<T>(path, true);
    }

    if (!response.ok) {
      throw new JiraApiError(response.status, url);
    }

    return (await response.json()) as T;
  }

  /**
   * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-get
   * The legacy /rest/api/3/search (startAt/total) was removed by Atlassian
   * in 2025 — this is the enhanced JQL search, paginated by token.
   */
  searchIssues(jql: string, nextPageToken?: string): Promise<JiraSearchPage> {
    const params = new URLSearchParams({
      jql,
      maxResults: String(SEARCH_PAGE_SIZE),
      fields: "summary,status,priority,project,created,updated,reporter,assignee",
    });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    return this.request<JiraSearchPage>(`/rest/api/3/search/jql?${params.toString()}`);
  }

  /** https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-changelogs/ */
  fetchChangelogPage(issueIdOrKey: string, startAt = 0): Promise<JiraChangelogPage> {
    const params = new URLSearchParams({ startAt: String(startAt), maxResults: "100" });
    return this.request<JiraChangelogPage>(`/rest/api/3/issue/${issueIdOrKey}/changelog?${params.toString()}`);
  }

  /** https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/ */
  fetchRemoteLinks(issueIdOrKey: string): Promise<JiraRemoteLink[]> {
    return this.request<JiraRemoteLink[]>(`/rest/api/3/issue/${issueIdOrKey}/remotelink`);
  }

  /**
   * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflow-statuses/#api-rest-api-3-status-get
   * The site-wide status list — small (tens, not thousands), unpaginated.
   */
  fetchStatuses(): Promise<JiraStatus[]> {
    return this.request<JiraStatus[]>("/rest/api/3/status");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
