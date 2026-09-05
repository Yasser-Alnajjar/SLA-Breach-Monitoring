import type { JiraChangelogPage, JiraCredentials, JiraRemoteLink, JiraSearchPage } from "./types";

const SEARCH_PAGE_SIZE = 100;

/** Thin, provider-aware fetch wrapper. Everything past this file is provider-agnostic. */
export class JiraClient {
  constructor(private readonly credentials: JiraCredentials) {}

  private baseUrl(): string {
    return `https://api.atlassian.com/ex/jira/${this.credentials.cloudId}`;
  }

  private async request<T>(path: string): Promise<T> {
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
      return this.request<T>(path);
    }

    if (!response.ok) {
      throw new Error(`Jira API error ${response.status} for ${url}: ${await response.text()}`);
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
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
