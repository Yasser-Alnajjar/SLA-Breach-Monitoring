import { afterEach, describe, expect, it, vi } from "vitest";
import { JiraApiError, JiraClient, JiraPermissionDeniedError } from "../src/client";
import type { JiraCredentials } from "../src/types";

const baseCredentials: JiraCredentials = {
  cloudId: "cloud-1",
  siteUrl: "https://acme.atlassian.net",
  accessToken: "token",
  tokenType: "Bearer",
  scope: "read:jira-work",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JiraClient 403 handling", () => {
  it("throws JiraPermissionDeniedError on a 403 without attempting a token refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { errorMessages: ["Forbidden"] }));
    vi.stubGlobal("fetch", fetchMock);
    const onUnauthorized = vi.fn();
    const client = new JiraClient(baseCredentials, { onUnauthorized });

    const error = await client.fetchStatuses().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraPermissionDeniedError);
    // Still a JiraApiError, so existing `status` checks (e.g. the webhook's 404 case) keep working.
    expect(error).toBeInstanceOf(JiraApiError);
    expect((error as JiraApiError).status).toBe(403);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves other failures as a plain JiraApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { errorMessages: ["Not found"] })));
    const client = new JiraClient(baseCredentials);

    const error = await client.fetchStatuses().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(JiraApiError);
    expect(error).not.toBeInstanceOf(JiraPermissionDeniedError);
    expect((error as JiraApiError).status).toBe(404);
  });
});
