import type { ZendeskOAuthConfig } from "@sla/zendesk";

export const ZENDESK_STATE_COOKIE = "zendesk_oauth_state";

export function getZendeskOAuthConfig(): ZendeskOAuthConfig {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Zendesk OAuth is not configured: ZENDESK_CLIENT_ID, ZENDESK_CLIENT_SECRET, and NEXTAUTH_URL are required",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/zendesk/callback`,
  };
}
