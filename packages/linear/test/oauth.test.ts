import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCodeForToken, LinearOAuthError } from "../src/oauth";

const config = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.example.com/api/integrations/linear/callback",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthorizeUrl", () => {
  it("targets Linear's authorize endpoint with the read-only scope", () => {
    const url = new URL(
      buildAuthorizeUrl(
        { clientId: "client-123", redirectUri: "https://app.example.com/api/integrations/linear/callback" },
        "state-abc",
      ),
    );

    expect(url.origin).toBe("https://linear.app");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/linear/callback");
    expect(url.searchParams.get("scope")).toBe("read");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
});

describe("exchangeCodeForToken", () => {
  it("posts a form-encoded body and returns the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: "access-1", token_type: "Bearer", scope: "read" }));
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await exchangeCodeForToken("code-1", config);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    const sentBody = new URLSearchParams((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sentBody.get("grant_type")).toBe("authorization_code");
    expect(sentBody.get("code")).toBe("code-1");

    expect(credentials.accessToken).toBe("access-1");
    expect(credentials.tokenType).toBe("Bearer");
    expect(credentials.scope).toBe("read");
  });

  it("throws a structured error on a bad authorization code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" })));

    await expect(exchangeCodeForToken("bad-code", config)).rejects.toMatchObject({
      name: "LinearOAuthError",
      status: 400,
      code: "invalid_grant",
    });
  });

  it("never includes the client secret or code in the thrown error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" })));

    const error = await exchangeCodeForToken("super-secret-code", config).catch((e: Error) => e);
    expect(error).toBeInstanceOf(LinearOAuthError);
    expect(String(error)).not.toContain("super-secret-code");
    expect(String(error)).not.toContain(config.clientSecret);
  });
});
