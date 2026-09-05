import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../src/oauth";

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
