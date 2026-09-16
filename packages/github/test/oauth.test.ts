import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, GithubOAuthError, refreshAccessToken } from "../src/oauth";

const config = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.example.com/api/integrations/github/callback",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthorizeUrl", () => {
  it("targets GitHub's authorize endpoint without requesting any scope", () => {
    const url = new URL(
      buildAuthorizeUrl(
        { clientId: "client-123", redirectUri: "https://app.example.com/api/integrations/github/callback" },
        "state-abc",
      ),
    );

    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/github/callback",
    );
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("state")).toBe("state-abc");
  });
});

describe("exchangeCodeForToken", () => {
  it("posts a form-encoded body and returns the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: "access-1", token_type: "bearer", scope: "repo" }));
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await exchangeCodeForToken("code-1", config);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      }),
    );
    const sentBody = new URLSearchParams((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody.get("client_id")).toBe("client-123");
    expect(sentBody.get("code")).toBe("code-1");

    expect(credentials.accessToken).toBe("access-1");
    expect(credentials.tokenType).toBe("bearer");
    expect(credentials.scope).toBe("repo");
    expect(credentials.refreshToken).toBeUndefined();
    expect(credentials.expiresAt).toBeUndefined();
  });

  it("records the refresh token and expiry a GitHub App returns", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-16T00:00:00.000Z") });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          access_token: "ghu_access",
          token_type: "bearer",
          scope: "",
          expires_in: 28800,
          refresh_token: "ghr_refresh",
          refresh_token_expires_in: 15811200,
        }),
      ),
    );

    const credentials = await exchangeCodeForToken("code-1", config);

    expect(credentials).toEqual({
      accessToken: "ghu_access",
      tokenType: "bearer",
      scope: "",
      refreshToken: "ghr_refresh",
      expiresAt: new Date("2026-09-16T08:00:00.000Z").getTime(),
    });
    vi.useRealTimers();
  });

  it("does not flag an authorization-code failure as requiring reauth", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "bad_verification_code" })));

    await expect(exchangeCodeForToken("bad-code", config)).rejects.toMatchObject({ requiresReauth: false });
  });

  it("throws a structured error on a bad authorization code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "bad_verification_code" })));

    await expect(exchangeCodeForToken("bad-code", config)).rejects.toMatchObject({
      name: "GithubOAuthError",
      status: 400,
      code: "bad_verification_code",
    });
  });

  it("treats a 200 response carrying an `error` field as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "bad_verification_code" })));

    await expect(exchangeCodeForToken("bad-code", config)).rejects.toBeInstanceOf(GithubOAuthError);
  });

  it("never includes the client secret or code in the thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "bad_verification_code" })));

    const error = await exchangeCodeForToken("super-secret-code", config).catch((e: Error) => e);
    expect(error).toBeInstanceOf(GithubOAuthError);
    expect(String(error)).not.toContain("super-secret-code");
    expect(String(error)).not.toContain(config.clientSecret);
  });
});

describe("refreshAccessToken", () => {
  it("posts a refresh_token grant and returns the rotated tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { access_token: "ghu_new", token_type: "bearer", expires_in: 28800, refresh_token: "ghr_new" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await refreshAccessToken("ghr_old", config);

    const sentBody = new URLSearchParams((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody.get("grant_type")).toBe("refresh_token");
    expect(sentBody.get("refresh_token")).toBe("ghr_old");
    expect(sentBody.get("client_id")).toBe("client-123");
    expect(sentBody.get("client_secret")).toBe("secret-xyz");
    expect(credentials.accessToken).toBe("ghu_new");
    expect(credentials.refreshToken).toBe("ghr_new");
  });

  it("flags bad_refresh_token (returned with HTTP 200) as requiring reauth", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "bad_refresh_token" })));

    await expect(refreshAccessToken("ghr_dead", config)).rejects.toMatchObject({
      name: "GithubOAuthError",
      code: "bad_refresh_token",
      requiresReauth: true,
    });
  });

  it("does not flag a client-credential error as requiring reauth", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "incorrect_client_credentials" })));

    await expect(refreshAccessToken("ghr_ok", config)).rejects.toMatchObject({ requiresReauth: false });
  });
});
