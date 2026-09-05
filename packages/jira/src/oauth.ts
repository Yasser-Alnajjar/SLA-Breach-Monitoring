import type { JiraAccessibleResource, JiraCredentials } from "./types";

export interface JiraOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Read-only scopes — no write access is ever requested (Phase 10: stay
 * read-only in v1). `offline_access` is required to receive a refresh token.
 */
const SCOPE = "read:jira-work offline_access";

const AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

export function buildAuthorizeUrl(
  config: Pick<JiraOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

/**
 * Exchanges the authorization code for a token, then resolves the Jira Cloud
 * site to talk to via the accessible-resources endpoint. v1 assumes one Jira
 * site is granted per org and uses the first one returned.
 */
export async function exchangeCodeForToken(code: string, config: JiraOAuthConfig): Promise<JiraCredentials> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Jira token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }

  const token = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    scope: string;
  };

  const resourcesResponse = await fetch(ACCESSIBLE_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
  });

  if (!resourcesResponse.ok) {
    throw new Error(
      `Jira accessible-resources lookup failed: ${resourcesResponse.status} ${await resourcesResponse.text()}`,
    );
  }

  const resources = (await resourcesResponse.json()) as JiraAccessibleResource[];
  const site = resources[0];
  if (!site) {
    throw new Error("Jira authorization granted no accessible sites");
  }

  return {
    cloudId: site.id,
    siteUrl: site.url,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    scope: token.scope,
  };
}
