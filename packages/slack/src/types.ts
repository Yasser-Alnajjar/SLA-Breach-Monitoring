export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Persisted per organization (see `SlackIntegration` in packages/db). The
 * bot token is a single workspace-level token — v1 sends every alert as the
 * app, never as a user, so there is nothing per-user to store.
 */
export interface SlackCredentials {
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
}

export interface SlackChannel {
  id: string;
  name: string;
}
