import type { SlackOAuthConfig } from "@sla/slack";

export const SLACK_STATE_COOKIE = "slack_oauth_state";

export function getSlackOAuthConfig(): SlackOAuthConfig {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Slack OAuth is not configured: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and NEXTAUTH_URL are required",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/slack/callback`,
  };
}
