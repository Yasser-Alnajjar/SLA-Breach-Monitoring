import type { LinearOAuthConfig } from "@sla/linear";

export const LINEAR_STATE_COOKIE = "linear_oauth_state";

export function getLinearOAuthConfig(): LinearOAuthConfig {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const appUrl = process.env.NEXTAUTH_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Linear OAuth is not configured: LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, and NEXTAUTH_URL are required",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/linear/callback`,
  };
}
