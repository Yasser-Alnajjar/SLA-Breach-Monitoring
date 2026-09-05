import { afterEach, describe, expect, it, vi } from "vitest";
import { ZendeskApiError, ZendeskClient } from "../src/client";
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
