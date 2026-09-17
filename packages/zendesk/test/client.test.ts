import { afterEach, describe, expect, it, vi } from "vitest";
import { ZendeskApiError, ZendeskClient, ZendeskPermissionDeniedError } from "../src/client";
import type { ZendeskCredentials } from "../src/types";

const baseCredentials: ZendeskCredentials = {
  subdomain: "acme",
  accessToken: "stale-token",
  tokenType: "bearer",
  scope: "read",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ZendeskClient 401 handling", () => {
  it("refreshes once and retries the request on a single 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "token expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { sla_policies: [], next_page: null }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn().mockResolvedValue({ ...baseCredentials, accessToken: "fresh-token" });
    const client = new ZendeskClient(baseCredentials, { onUnauthorized });

    const result = await client.fetchSlaPoliciesPage();

    expect(result).toEqual({ sla_policies: [], next_page: null });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith(baseCredentials);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer fresh-token" },
    });
  });

  it("does not retry indefinitely when the refreshed token also gets a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "still unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn().mockResolvedValue({ ...baseCredentials, accessToken: "fresh-token" });
    const client = new ZendeskClient(baseCredentials, { onUnauthorized });

    await expect(client.fetchSlaPoliciesPage()).rejects.toBeInstanceOf(ZendeskApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on 401 when no onUnauthorized handler is configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized" })));

    const client = new ZendeskClient(baseCredentials);
    await expect(client.fetchSlaPoliciesPage()).rejects.toBeInstanceOf(ZendeskApiError);
  });
});

describe("ZendeskClient 403 handling", () => {
  it("throws ZendeskPermissionDeniedError on a 403 without attempting a token refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" }));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();
    const client = new ZendeskClient(baseCredentials, { onUnauthorized });

    const error = await client.fetchSlaPoliciesPage().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ZendeskPermissionDeniedError);
    // Still a ZendeskApiError, so existing `status` checks keep working.
    expect(error).toBeInstanceOf(ZendeskApiError);
    expect((error as ZendeskApiError).status).toBe(403);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves other failures as a plain ZendeskApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "boom" })));
    const client = new ZendeskClient(baseCredentials);

    const error = await client.fetchSlaPoliciesPage().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ZendeskApiError);
    expect(error).not.toBeInstanceOf(ZendeskPermissionDeniedError);
  });
});

describe("ZendeskClient.fetchTicketAuditsPage", () => {
  it("sideloads users on the first page and on a next_page URL that dropped the include", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { audits: [], users: [], next_page: null }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ZendeskClient(baseCredentials);

    await client.fetchTicketAuditsPage(51);
    await client.fetchTicketAuditsPage(51, "https://acme.zendesk.com/api/v2/tickets/51/audits.json?page=2");
    await client.fetchTicketAuditsPage(51, "https://acme.zendesk.com/api/v2/tickets/51/audits.json?page=3&include=users");

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://acme.zendesk.com/api/v2/tickets/51/audits.json?include=users",
      "https://acme.zendesk.com/api/v2/tickets/51/audits.json?page=2&include=users",
      "https://acme.zendesk.com/api/v2/tickets/51/audits.json?page=3&include=users",
    ]);
  });
});

// Requester-name resolution (case/customer/requester separation) reads the
// ticket's requester off this `users` sideload — these lock in that the
// sideload is actually requested on every path a ticket can be fetched from,
// so a requester name is available without a separate per-user request.
describe("ZendeskClient requester sideload (include=users)", () => {
  it("fetchTicket sideloads users on a single-ticket fetch", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { ticket: { id: 51 }, users: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ZendeskClient(baseCredentials);

    await client.fetchTicket(51);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://acme.zendesk.com/api/v2/tickets/51.json?include=users");
  });

  it("fetchTicketsPage sideloads users on the incremental export's first page", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse(200, { tickets: [], end_time: 1000, next_page: null, count: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ZendeskClient(baseCredentials);

    await client.fetchTicketsPage(500);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://acme.zendesk.com/api/v2/incremental/tickets.json?start_time=500&include=users",
    );
  });

  it("fetchTicketsNextPage sideloads users on a next_page URL, re-applying include if Zendesk dropped it", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse(200, { tickets: [], end_time: 1000, next_page: null, count: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ZendeskClient(baseCredentials);

    await client.fetchTicketsNextPage("https://acme.zendesk.com/api/v2/incremental/tickets.json?cursor=abc");
    await client.fetchTicketsNextPage(
      "https://acme.zendesk.com/api/v2/incremental/tickets.json?cursor=def&include=users",
    );

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://acme.zendesk.com/api/v2/incremental/tickets.json?cursor=abc&include=users",
      "https://acme.zendesk.com/api/v2/incremental/tickets.json?cursor=def&include=users",
    ]);
  });
});
