import type { GithubOAuthConfig } from "@sla/github";
import { getIntegrationConfig, getPrismaClient } from "@sla/db";

export const GITHUB_STATE_COOKIE = "github_oauth_state";

/**
 * Resolves this organization's GitHub OAuth app config: its own
 * client id/secret, saved from the Integrations settings UI.
 */
export async function getGithubOAuthConfig(organizationId: string): Promise<GithubOAuthConfig> {
  const appUrl = process.env.NEXTAUTH_URL;
  const config = await getIntegrationConfig(getPrismaClient(), organizationId, "github");

  if (!config || !appUrl) {
    throw new Error(
      "GitHub is not configured for this organization. Configure it from Integrations settings.",
    );
  }

  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: `${appUrl}/api/integrations/github/callback`,
  };
}
