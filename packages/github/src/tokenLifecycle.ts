import type { Prisma, PrismaClient } from "@sla/db";
import type { GithubCredentials } from "./types";

/**
 * Thrown when GitHub rejects the access token and there is no refresh path
 * (GitHub OAuth App tokens carry no refresh token — see oauth.ts). Distinguishes
 * "the integration needs the user to reconnect" from a transient/network
 * failure — callers should surface this rather than retrying, and never
 * delete the integration for it.
 */
export class GithubReauthRequiredError extends Error {
  constructor(message = "GitHub integration requires reauthorization") {
    super(message);
    this.name = "GithubReauthRequiredError";
  }
}

async function readCredentials(prisma: PrismaClient, integrationId: string): Promise<GithubCredentials> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  return integration.credentials as unknown as GithubCredentials;
}

/**
 * Compare-and-swap on the whole credentials JSON blob: only writes if the row
 * still holds exactly `expected` (Postgres jsonb equality is deep, so key
 * order doesn't matter). If another process already marked reauthRequired (or
 * the user already reconnected) in the meantime, we lose the race harmlessly
 * and defer to whatever it wrote instead of clobbering it.
 */
async function persistCredentialsIfUnchanged(
  prisma: PrismaClient,
  integrationId: string,
  expected: GithubCredentials,
  next: GithubCredentials,
): Promise<GithubCredentials> {
  const result = await prisma.integration.updateMany({
    where: { id: integrationId, credentials: { equals: expected as unknown as Prisma.InputJsonValue } },
    data: { credentials: next as unknown as Prisma.InputJsonValue },
  });

  if (result.count > 0) return next;
  return readCredentials(prisma, integrationId);
}

/** Loads current credentials, throwing if the integration is already known to need reconnection. */
export async function loadFreshGithubCredentials(
  prisma: PrismaClient,
  integrationId: string,
): Promise<GithubCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new GithubReauthRequiredError();
  return current;
}

/**
 * GithubClient's 401 fallback. Re-reads current credentials first: if another
 * process already reconnected the integration since our request was made
 * with `failedCredentials`, we just adopt that instead of marking it dead a
 * second time. Since GitHub issues no refresh token, a 401 is unambiguous —
 * there is no path back except the user reconnecting.
 */
export async function markReauthRequired(
  prisma: PrismaClient,
  integrationId: string,
  failedCredentials: GithubCredentials,
): Promise<GithubCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new GithubReauthRequiredError();
  if (current.accessToken !== failedCredentials.accessToken) return current;

  await persistCredentialsIfUnchanged(prisma, integrationId, current, { ...current, reauthRequired: true });
  throw new GithubReauthRequiredError();
}
