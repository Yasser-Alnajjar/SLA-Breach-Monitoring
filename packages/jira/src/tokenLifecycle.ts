import type { Prisma, PrismaClient } from "@sla/db";
import { refreshAccessToken, JiraOAuthError, type JiraOAuthConfig } from "./oauth";
import type { JiraCredentials } from "./types";

/** Refresh this far ahead of the recorded expiry, to absorb request latency. */
const EXPIRY_SAFETY_MARGIN_MS = 2 * 60 * 1000;

/**
 * Thrown when a refresh attempt fails because the refresh token itself is
 * invalid, expired, or revoked. Distinguishes "the integration needs the user
 * to reconnect" from a transient/network failure — callers should surface
 * this rather than retrying, and never delete the integration for it.
 */
export class JiraReauthRequiredError extends Error {
  constructor(message = "Jira integration requires reauthorization") {
    super(message);
    this.name = "JiraReauthRequiredError";
  }
}

function isExpiringSoon(credentials: JiraCredentials): boolean {
  if (credentials.expiresAt === undefined) return false; // unknown expiry: nothing to refresh against
  return credentials.expiresAt - EXPIRY_SAFETY_MARGIN_MS <= Date.now();
}

async function readCredentials(prisma: PrismaClient, integrationId: string): Promise<JiraCredentials> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  return integration.credentials as unknown as JiraCredentials;
}

/**
 * Compare-and-swap on the whole credentials JSON blob: only writes if the row
 * still holds exactly `expected` (Postgres jsonb equality is deep, so key
 * order doesn't matter). If another process already rotated the tokens
 * (or marked reauthRequired) in the meantime, we lose the race harmlessly and
 * defer to whatever it wrote instead of clobbering it.
 */
async function persistCredentialsIfUnchanged(
  prisma: PrismaClient,
  integrationId: string,
  expected: JiraCredentials,
  next: JiraCredentials,
): Promise<JiraCredentials> {
  const result = await prisma.integration.updateMany({
    where: { id: integrationId, credentials: { equals: expected as unknown as Prisma.InputJsonValue } },
    data: { credentials: next as unknown as Prisma.InputJsonValue },
  });

  if (result.count > 0) return next;
  return readCredentials(prisma, integrationId);
}

/**
 * Per-process de-dup only — avoids firing duplicate refresh calls when
 * several requests in the *same* runtime instance race. It is NOT what makes
 * concurrent refresh safe: this app is deployed as multi-instance/serverless
 * functions, so an in-memory lock alone would not prevent two different
 * instances from refreshing at once. Correctness across instances comes from
 * the DB-level compare-and-swap in persistCredentialsIfUnchanged above.
 */
const inFlightRefreshes = new Map<string, Promise<JiraCredentials>>();

async function doRefresh(
  prisma: PrismaClient,
  integrationId: string,
  config: JiraOAuthConfig,
  current: JiraCredentials,
  options: { onMissingRefreshToken: "returnUnchanged" | "requireReauth" },
): Promise<JiraCredentials> {
  if (current.reauthRequired) throw new JiraReauthRequiredError();

  if (!current.refreshToken) {
    if (options.onMissingRefreshToken === "returnUnchanged") return current;
    // A 401 with nothing to refresh with is unambiguous: this token is dead and
    // unrecoverable without the user reconnecting. Mark it rather than silently
    // retrying the same dead token forever.
    await persistCredentialsIfUnchanged(prisma, integrationId, current, { ...current, reauthRequired: true });
    throw new JiraReauthRequiredError();
  }

  let refreshed: JiraCredentials;
  try {
    refreshed = await refreshAccessToken(current, current.refreshToken, config);
  } catch (error) {
    if (error instanceof JiraOAuthError && error.requiresReauth) {
      await persistCredentialsIfUnchanged(prisma, integrationId, current, { ...current, reauthRequired: true });
      throw new JiraReauthRequiredError();
    }
    throw error;
  }

  return persistCredentialsIfUnchanged(prisma, integrationId, current, refreshed);
}

function refreshWithSingleFlight(
  prisma: PrismaClient,
  integrationId: string,
  config: JiraOAuthConfig,
  current: JiraCredentials,
  options: { onMissingRefreshToken: "returnUnchanged" | "requireReauth" },
): Promise<JiraCredentials> {
  const existing = inFlightRefreshes.get(integrationId);
  if (existing) return existing;

  const promise = doRefresh(prisma, integrationId, config, current, options).finally(() => {
    inFlightRefreshes.delete(integrationId);
  });
  inFlightRefreshes.set(integrationId, promise);
  return promise;
}

/** Loads current credentials, refreshing proactively first if the access token is near expiry. */
export async function loadFreshJiraCredentials(
  prisma: PrismaClient,
  integrationId: string,
  config: JiraOAuthConfig,
): Promise<JiraCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new JiraReauthRequiredError();
  if (!isExpiringSoon(current)) return current;
  // No refresh token and no known expiry is the normal "legacy/non-expiring" shape —
  // not itself evidence of a problem, so don't mark reauth just because it's absent here.
  return refreshWithSingleFlight(prisma, integrationId, config, current, { onMissingRefreshToken: "returnUnchanged" });
}

/**
 * JiraClient's 401 fallback. Re-reads current credentials first: if another
 * process already rotated the access token since our request was made with
 * `failedCredentials`, we just adopt that instead of refreshing again —
 * avoiding a redundant refresh_token rotation race. A 401 with no refresh
 * token to fall back on is unambiguous, though: the token is dead and there
 * is no path back except the user reconnecting.
 */
export async function refreshAfterUnauthorized(
  prisma: PrismaClient,
  integrationId: string,
  config: JiraOAuthConfig,
  failedCredentials: JiraCredentials,
): Promise<JiraCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new JiraReauthRequiredError();
  if (current.accessToken !== failedCredentials.accessToken) return current;
  return refreshWithSingleFlight(prisma, integrationId, config, current, { onMissingRefreshToken: "requireReauth" });
}
