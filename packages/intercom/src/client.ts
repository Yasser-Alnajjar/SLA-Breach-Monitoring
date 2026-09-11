import type {
  IntercomCompaniesPage,
  IntercomContact,
  IntercomConversationSearchPage,
  IntercomConversationWithParts,
  IntercomCredentials,
} from "./types";

const API_URL = "https://api.intercom.io";
const PAGE_SIZE = 50;
/** Pinned so a future Intercom API version bump can't silently change response shapes under us. */
const API_VERSION = "2.11";

export class IntercomApiError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`Intercom API error ${status} for ${url}`);
    this.name = "IntercomApiError";
    this.status = status;
  }
}

export interface IntercomClientOptions {
  /**
   * Called at most once per request when Intercom responds 401. Receives the
   * credentials that were just rejected (so the caller can tell whether
   * another process already rotated them) and must return credentials to
   * retry with. Throwing here (e.g. a reauth-required error) aborts the retry.
   */
  onUnauthorized?: (failedCredentials: IntercomCredentials) => Promise<IntercomCredentials>;
}

/** Thin, provider-aware fetch wrapper. Everything past this file is provider-agnostic. */
export class IntercomClient {
  private credentials: IntercomCredentials;
  private readonly onUnauthorized?: (failedCredentials: IntercomCredentials) => Promise<IntercomCredentials>;

  constructor(credentials: IntercomCredentials, options: IntercomClientOptions = {}) {
    this.credentials = credentials;
    this.onUnauthorized = options.onUnauthorized;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    hasRetriedAuth = false,
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${API_URL}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        Accept: "application/json",
        "Intercom-Version": API_VERSION,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (response.status === 429) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "5");
      await sleep(retryAfterSeconds * 1000);
      return this.request<T>(path, init, hasRetriedAuth);
    }

    if (response.status === 401 && this.onUnauthorized && !hasRetriedAuth) {
      this.credentials = await this.onUnauthorized(this.credentials);
      return this.request<T>(path, init, true);
    }

    if (!response.ok) {
      throw new IntercomApiError(response.status, url);
    }

    return (await response.json()) as T;
  }

  /**
   * https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/searchconversations
   * Summary rows only — no `conversation_parts`. `fetchConversation` below
   * fills that in per conversation.
   */
  searchConversations(updatedSinceEpochSeconds: number, startingAfter?: string): Promise<IntercomConversationSearchPage> {
    return this.request<IntercomConversationSearchPage>("/conversations/search", {
      method: "POST",
      body: JSON.stringify({
        query: { field: "updated_at", operator: ">", value: updatedSinceEpochSeconds },
        pagination: { per_page: PAGE_SIZE, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      }),
    });
  }

  /** https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/retrieveconversation — the only endpoint that returns the full conversation_parts thread. */
  fetchConversation(conversationId: string): Promise<IntercomConversationWithParts> {
    return this.request<IntercomConversationWithParts>(`/conversations/${conversationId}`);
  }

  /** https://developers.intercom.com/docs/references/rest-api/api.intercom.io/companies/listcompanies — accounts have few companies, so pulled as a small full snapshot rather than incrementally. */
  fetchCompaniesPage(page = 1): Promise<IntercomCompaniesPage> {
    return this.request<IntercomCompaniesPage>(`/companies?page=${page}&per_page=${PAGE_SIZE}`);
  }

  /** https://developers.intercom.com/docs/references/rest-api/api.intercom.io/contacts/retrievecontact — resolves a conversation's primary contact to its company. */
  fetchContact(contactId: string): Promise<IntercomContact> {
    return this.request<IntercomContact>(`/contacts/${contactId}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
