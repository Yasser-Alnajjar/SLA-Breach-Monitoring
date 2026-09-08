import type {
  ZendeskAuditsPage,
  ZendeskBusinessHoursSchedulesPage,
  ZendeskCredentials,
  ZendeskIncrementalOrganizationExport,
  ZendeskIncrementalTicketExport,
  ZendeskScheduleHolidaysPage,
  ZendeskSlaPoliciesPage,
  ZendeskTicket,
} from "./types";

export class ZendeskApiError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`Zendesk API error ${status} for ${url}`);
    this.name = "ZendeskApiError";
    this.status = status;
  }
}

export interface ZendeskClientOptions {
  /**
   * Called at most once per request when Zendesk responds 401. Receives the
   * credentials that were just rejected (so the caller can tell whether
   * another process already rotated them) and must return credentials to
   * retry with. Throwing here (e.g. a reauth-required error) aborts the retry.
   */
  onUnauthorized?: (failedCredentials: ZendeskCredentials) => Promise<ZendeskCredentials>;
}

/** Thin, provider-aware fetch wrapper. Everything past this file is provider-agnostic. */
export class ZendeskClient {
  private credentials: ZendeskCredentials;
  private readonly onUnauthorized?: (failedCredentials: ZendeskCredentials) => Promise<ZendeskCredentials>;

  constructor(credentials: ZendeskCredentials, options: ZendeskClientOptions = {}) {
    this.credentials = credentials;
    this.onUnauthorized = options.onUnauthorized;
  }

  private baseUrl(): string {
    return `https://${this.credentials.subdomain}.zendesk.com`;
  }

  private async request<T>(path: string, hasRetriedAuth = false): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl()}${path}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
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
      throw new ZendeskApiError(response.status, url);
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

  /**
   * https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#show-ticket
   * Single-ticket fetch for a targeted refetch (roadmap step 20's webhook
   * receiver) — unlike the incremental export, this reflects the ticket's
   * state at the moment of the call rather than at the last poll window.
   */
  fetchTicket(ticketId: number): Promise<{ ticket: ZendeskTicket }> {
    return this.request<{ ticket: ZendeskTicket }>(`/api/v2/tickets/${ticketId}.json`);
  }

  /** https://developer.zendesk.com/api-reference/ticketing/business-hours/schedules/ — accounts have few schedules, so Zendesk returns them unpaginated. */
  fetchBusinessHoursSchedules(): Promise<ZendeskBusinessHoursSchedulesPage> {
    return this.request<ZendeskBusinessHoursSchedulesPage>("/api/v2/business_hours/schedules.json");
  }

  fetchScheduleHolidaysPage(scheduleId: number, nextPageUrl?: string): Promise<ZendeskScheduleHolidaysPage> {
    return this.request<ZendeskScheduleHolidaysPage>(
      nextPageUrl ?? `/api/v2/business_hours/schedules/${scheduleId}/holidays.json`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
