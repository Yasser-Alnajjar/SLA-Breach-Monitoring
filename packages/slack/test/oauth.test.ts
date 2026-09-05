import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../src/oauth";

describe("buildAuthorizeUrl", () => {
  it("targets Slack's v2 authorize endpoint with bot-only scopes", () => {
    const url = new URL(
      buildAuthorizeUrl(
        { clientId: "client-123", redirectUri: "https://app.example.com/api/integrations/slack/callback" },
        "state-abc",
      ),
    );

    expect(url.origin).toBe("https://slack.com");
    expect(url.pathname).toBe("/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/slack/callback");
    expect(url.searchParams.get("scope")).toBe("chat:write,chat:write.public,channels:read,groups:read");
    expect(url.searchParams.get("state")).toBe("state-abc");
    // No user-token scope requested — the app never asks for anything beyond
    // posting as itself and reading the channel list for the picker.
    expect(url.searchParams.get("user_scope")).toBeNull();
  });
});
