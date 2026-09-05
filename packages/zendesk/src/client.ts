import type {
  ZendeskAuditsPage,
  ZendeskCredentials,
  ZendeskIncrementalOrganizationExport,
  ZendeskIncrementalTicketExport,
  ZendeskSlaPoliciesPage,
} from "./types";

/** Thin, provider-aware fetch wrapper. Everything past this file is provider-agnostic. */
export class ZendeskClient {
  constructor(private readonly credentials: ZendeskCredentials) {}

  private baseUrl(): string {
    return `https://${this.credentials.subdomain}.zendesk.com`;
  }

  private async request<T>(path: string): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl()}${path}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
    });

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "5");
      await sleep(retryAfterSeconds * 1000);
      return this.request<T>(path);
    }

    if (!response.ok) {
      throw new Error(`Zendesk API error ${response.status} for ${url}: ${await response.text()}`);
    }

    return (await response.json()) as T;
  }

  /** https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/ */
  fetchTicketsPage(startTime: number): Promise<ZendeskIncrementalTicketExport> {
    return this.request<ZendeskIncrementalTicketExport>(
      `/api/v2/incremental/tickets.json?start_time=${startTime}`,
    );
  }

  fetchTicketsNextPage(nextPageUrl: string): Promise<ZendeskIncrementalTicketExport> {
    return this.request<ZendeskIncrementalTicketExport>(nextPageUrl);
  }

  fetchOrganizationsPage(startTime: number): Promise<ZendeskIncrementalOrganizationExport> {
    return this.request<ZendeskIncrementalOrganizationExport>(
      `/api/v2/incremental/organizations.json?start_time=${startTime}`,
    );
  }

  fetchOrganizationsNextPage(nextPageUrl: string): Promise<ZendeskIncrementalOrganizationExport> {
    return this.request<ZendeskIncrementalOrganizationExport>(nextPageUrl);
  }

  fetchSlaPoliciesPage(nextPageUrl?: string): Promise<ZendeskSlaPoliciesPage> {
    return this.request<ZendeskSlaPoliciesPage>(nextPageUrl ?? "/api/v2/slas/policies.json");
  }

  fetchTicketAuditsPage(ticketId: number, nextPageUrl?: string): Promise<ZendeskAuditsPage> {
    return this.request<ZendeskAuditsPage>(nextPageUrl ?? `/api/v2/tickets/${ticketId}/audits.json`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
