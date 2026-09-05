import type { JiraOAuthConfig } from "@sla/jira";

export const JIRA_STATE_COOKIE = "jira_oauth_state";

export function getJiraOAuthConfig(): JiraOAuthConfig {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Jira OAuth is not configured: JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and NEXTAUTH_URL are required",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/jira/callback`,
  };
}
