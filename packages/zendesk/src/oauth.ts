import type { ZendeskCredentials } from "./types";

export interface ZendeskOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Read-only scope — no write access is ever requested (Phase 10: stay read-only in v1). */
const SCOPE = "read";

export function buildAuthorizeUrl(
  subdomain: string,
  config: Pick<ZendeskOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(`https://${subdomain}.zendesk.com/oauth/authorizations/new`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  subdomain: string,
  code: string,
  config: ZendeskOAuthConfig,
): Promise<ZendeskCredentials> {
  const response = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      scope: SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zendesk token exchange failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    access_token: string;
    token_type: string;
    scope: string;
  };

  return {
    subdomain,
    accessToken: body.access_token,
    tokenType: body.token_type,
    scope: body.scope,
  };
}
