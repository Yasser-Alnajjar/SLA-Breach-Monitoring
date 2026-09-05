import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, JiraOAuthError } from "../src/oauth";

const config = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.example.com/api/integrations/jira/callback",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const accessibleResources = [{ id: "cloud-1", url: "https://acme.atlassian.net", name: "acme", scopes: ["read:jira-work"] }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthorizeUrl", () => {
  it("targets Atlassian's 3LO authorize endpoint with read-only scopes", () => {
    const url = new URL(
      buildAuthorizeUrl(
        { clientId: "client-123", redirectUri: "https://app.example.com/api/integrations/jira/callback" },
        "state-abc",
      ),
    );

    expect(url.origin).toBe("https://auth.atlassian.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("audience")).toBe("api.atlassian.com");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/jira/callback");
    expect(url.searchParams.get("scope")).toBe("read:jira-work offline_access");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});

describe("exchangeCodeForToken", () => {
  it("exchanges the code, then resolves the accessible Jira site", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: "access-1",
          refresh_token: "refresh-1",
          token_type: "bearer",
          scope: "read:jira-work offline_access",
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, accessibleResources));
    vi.stubGlobal("fetch", fetchMock);

    const before = Date.now();
    const credentials = await exchangeCodeForToken("code-1", config);
    const after = Date.now();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://auth.atlassian.com/oauth/token",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({ grant_type: "authorization_code", code: "code-1" });

    expect(credentials.cloudId).toBe("cloud-1");
    expect(credentials.siteUrl).toBe("https://acme.atlassian.net");
    expect(credentials.accessToken).toBe("access-1");
    expect(credentials.refreshToken).toBe("refresh-1");
    expect(credentials.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(credentials.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it("throws a structured error without requiring reauth on a bad authorization code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant", error_description: "code expired" })),
    );

    await expect(exchangeCodeForToken("bad-code", config)).rejects.toMatchObject({
      name: "JiraOAuthError",
      status: 400,
      code: "invalid_grant",
      requiresReauth: false,
    });
  });

  it("never includes the client secret or code in the thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" })));

    const error = await exchangeCodeForToken("super-secret-code", config).catch((e: Error) => e);
    expect(error).toBeInstanceOf(JiraOAuthError);
    expect(String(error)).not.toContain("super-secret-code");
    expect(String(error)).not.toContain(config.clientSecret);
  });

  it("throws when the authorization granted no accessible sites", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: "access-1", token_type: "bearer", scope: "read:jira-work offline_access" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, []));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeCodeForToken("code-1", config)).rejects.toThrow("no accessible sites");
  });
});

describe("refreshAccessToken", () => {
  const current = { cloudId: "cloud-1", siteUrl: "https://acme.atlassian.net" };

  it("sends grant_type=refresh_token and returns the new access token, carrying over the site", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: "access-2",
        token_type: "bearer",
        scope: "read:jira-work offline_access",
        expires_in: 3600,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await refreshAccessToken(current, "refresh-1", config);

    const sentBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    expect(credentials.accessToken).toBe("access-2");
    expect(credentials.cloudId).toBe("cloud-1");
    expect(credentials.siteUrl).toBe("https://acme.atlassian.net");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no accessible-resources re-lookup on refresh
  });

  it("replaces the old refresh token when Atlassian rotates it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          access_token: "access-2",
          refresh_token: "refresh-2",
          token_type: "bearer",
          scope: "read:jira-work offline_access",
        }),
      ),
    );

    const credentials = await refreshAccessToken(current, "refresh-1", config);
    expect(credentials.refreshToken).toBe("refresh-2");
  });

  it("keeps the existing refresh token when Atlassian does not return a new one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { access_token: "access-2", token_type: "bearer", scope: "read:jira-work offline_access" }),
      ),
    );

    const credentials = await refreshAccessToken(current, "refresh-1", config);
    expect(credentials.refreshToken).toBe("refresh-1");
  });

  it("flags requiresReauth when the refresh token itself is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant", error_description: "token revoked" })),
    );

    await expect(refreshAccessToken(current, "refresh-1", config)).rejects.toMatchObject({
      name: "JiraOAuthError",
      requiresReauth: true,
    });
  });

  it("does not flag requiresReauth for a transient server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { error: "internal_error" })));

    await expect(refreshAccessToken(current, "refresh-1", config)).rejects.toMatchObject({
      requiresReauth: false,
    });
  });
});
