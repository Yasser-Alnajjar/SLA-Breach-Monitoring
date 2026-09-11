import type { IntercomOAuthConfig } from "@sla/intercom";
import { getIntegrationConfig, getPrismaClient } from "@sla/db";

export const INTERCOM_STATE_COOKIE = "intercom_oauth_state";

/**
 * Resolves this organization's Intercom OAuth app config: its own client
 * id/secret, saved from the Integrations settings UI (roadmap step 21's
 * tenant-scoped IntegrationConfig — there is no `.env` fallback). Unlike
 * Zendesk/Jira/Linear, Intercom's config carries no `redirectUri`: that URL
 * is registered once on the app itself in Intercom's Developer Hub, not
 * passed per-request (see oauth.ts).
 */
export async function getIntercomOAuthConfig(organizationId: string): Promise<IntercomOAuthConfig> {
  const config = await getIntegrationConfig(getPrismaClient(), organizationId, "intercom");

  if (!config) {
    throw new Error("Intercom is not configured for this organization. Configure it from Integrations settings.");
  }

  return { clientId: config.clientId, clientSecret: config.clientSecret };
}
