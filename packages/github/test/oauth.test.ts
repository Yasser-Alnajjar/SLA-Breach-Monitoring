import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, GithubOAuthError } from "../src/oauth";

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
  it("targets GitHub's authorize endpoint with the repo scope", () => {
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
    expect(url.searchParams.get("scope")).toBe("repo");
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
