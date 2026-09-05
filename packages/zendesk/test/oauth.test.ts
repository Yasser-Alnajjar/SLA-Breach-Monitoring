import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, refreshAccessToken, ZendeskOAuthError } from "../src/oauth";

const config = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.example.com/api/integrations/zendesk/callback",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthorizeUrl", () => {
  it("targets the org's own Zendesk subdomain with a read-only scope", () => {
    const url = new URL(
      buildAuthorizeUrl(
        "acme",
        { clientId: "client-123", redirectUri: "https://app.example.com/api/integrations/zendesk/callback" },
        "state-abc",
      ),
    );

    expect(url.origin).toBe("https://acme.zendesk.com");
    expect(url.pathname).toBe("/oauth/authorizations/new");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/zendesk/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});

describe("exchangeCodeForToken", () => {
  it("captures refresh_token and computes expiry timestamps when Zendesk returns them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: "access-1",
        refresh_token: "refresh-1",
        token_type: "bearer",
        scope: "read",
        expires_in: 3600,
        refresh_token_expires_in: 1209600,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const before = Date.now();
    const credentials = await exchangeCodeForToken("acme", "code-1", config);
    const after = Date.now();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://acme.zendesk.com/oauth/tokens",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({ grant_type: "authorization_code", code: "code-1" });

    expect(credentials.subdomain).toBe("acme");
    expect(credentials.accessToken).toBe("access-1");
    expect(credentials.refreshToken).toBe("refresh-1");
    expect(credentials.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(credentials.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000);
    expect(credentials.refreshTokenExpiresAt).toBeGreaterThanOrEqual(before + 1209600 * 1000);
  });

  it("does not fabricate expiry/refresh fields for a non-expiring (legacy) OAuth client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "access-1", token_type: "bearer", scope: "read" })),
    );

    const credentials = await exchangeCodeForToken("acme", "code-1", config);

    expect(credentials.refreshToken).toBeUndefined();
    expect(credentials.expiresAt).toBeUndefined();
    expect(credentials.refreshTokenExpiresAt).toBeUndefined();
  });

  it("throws a structured error without requiring reauth on a bad authorization code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid_grant", error_description: "code expired" })),
    );

    await expect(exchangeCodeForToken("acme", "bad-code", config)).rejects.toMatchObject({
      name: "ZendeskOAuthError",
      status: 401,
      code: "invalid_grant",
      requiresReauth: false,
    });
  });

  it("never includes the client secret or code in the thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid_grant" })));

    const error = await exchangeCodeForToken("acme", "super-secret-code", config).catch((e: Error) => e);
    expect(error).toBeInstanceOf(ZendeskOAuthError);
    expect(String(error)).not.toContain("super-secret-code");
    expect(String(error)).not.toContain(config.clientSecret);
  });
});

describe("refreshAccessToken", () => {
  it("sends grant_type=refresh_token and returns the new access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "access-2", token_type: "bearer", scope: "read", expires_in: 3600 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await refreshAccessToken("acme", "refresh-1", config);

    const sentBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    expect(credentials.accessToken).toBe("access-2");
  });

  it("replaces the old refresh token when Zendesk rotates it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { access_token: "access-2", refresh_token: "refresh-2", token_type: "bearer", scope: "read" }),
      ),
    );

    const credentials = await refreshAccessToken("acme", "refresh-1", config);
    expect(credentials.refreshToken).toBe("refresh-2");
  });

  it("keeps the existing refresh token when Zendesk does not return a new one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "access-2", token_type: "bearer", scope: "read" })),
    );

    const credentials = await refreshAccessToken("acme", "refresh-1", config);
    expect(credentials.refreshToken).toBe("refresh-1");
  });

  it("flags requiresReauth when the refresh token itself is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid_grant", error_description: "token revoked" })),
    );

    await expect(refreshAccessToken("acme", "refresh-1", config)).rejects.toMatchObject({
      name: "ZendeskOAuthError",
      requiresReauth: true,
    });
  });

  it("does not flag requiresReauth for a transient server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { error: "internal_error" })));

    await expect(refreshAccessToken("acme", "refresh-1", config)).rejects.toMatchObject({
      requiresReauth: false,
    });
  });
});
