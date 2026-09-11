import type { GithubTokenCredentials } from "./types";

export interface GithubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * GitHub's classic OAuth Apps have no separate read-only scope for private
 * repositories — `repo` (full private-repo access, including write) is the
 * narrowest scope that can read a private repo's pull requests. Documented
 * here rather than glossed over: every other provider in this codebase
 * deliberately requests read-only scopes; GitHub is the one exception,
 * imposed by GitHub's own scope model, not a choice this app makes.
 */
const SCOPE = "repo";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

/** Structured OAuth failure from an authorization-code exchange. */
export class GithubOAuthError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = "GithubOAuthError";
    this.status = options.status;
    this.code = options.code;
  }
}

export function buildAuthorizeUrl(
  config: Pick<GithubOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

interface GithubTokenResponseBody {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
}

/**
 * GitHub's token endpoint defaults to form-encoded; `Accept: application/json`
 * gets a JSON body back instead, mirroring Linear's response shape. GitHub
 * also, unlike Linear, can return HTTP 200 with an `error` field in the body
 * rather than a non-2xx status — both are checked.
 */
export async function exchangeCodeForToken(
  code: string,
  config: GithubOAuthConfig,
): Promise<GithubTokenCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }).toString(),
  });

  const parsed = (await response.json().catch(() => null)) as GithubTokenResponseBody | null;

  if (!response.ok || !parsed?.access_token || parsed.error) {
    throw new GithubOAuthError(`GitHub OAuth token request failed with status ${response.status}`, {
      status: response.status,
      code: parsed?.error,
    });
  }

  return {
    accessToken: parsed.access_token,
    tokenType: parsed.token_type ?? "bearer",
    scope: parsed.scope ?? SCOPE,
  };
}
