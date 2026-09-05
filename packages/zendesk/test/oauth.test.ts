import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../src/oauth";

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
