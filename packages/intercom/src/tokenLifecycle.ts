import type { Prisma, PrismaClient } from "@sla/db";
import type { IntercomCredentials } from "./types";

/**
 * Thrown when Intercom rejects the access token and there is no refresh path
 * (Intercom's OAuth tokens carry no refresh token and don't expire — see
 * oauth.ts). Distinguishes "the integration needs the user to reconnect" from
 * a transient/network failure — callers should surface this rather than
 * retrying, and never delete the integration for it.
 */
export class IntercomReauthRequiredError extends Error {
  constructor(message = "Intercom integration requires reauthorization") {
    super(message);
    this.name = "IntercomReauthRequiredError";
  }
}

async function readCredentials(prisma: PrismaClient, integrationId: string): Promise<IntercomCredentials> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  return integration.credentials as unknown as IntercomCredentials;
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
  expected: IntercomCredentials,
  next: IntercomCredentials,
): Promise<IntercomCredentials> {
  const result = await prisma.integration.updateMany({
    where: { id: integrationId, credentials: { equals: expected as unknown as Prisma.InputJsonValue } },
    data: { credentials: next as unknown as Prisma.InputJsonValue },
  });

  if (result.count > 0) return next;
  return readCredentials(prisma, integrationId);
}

/** Loads current credentials, throwing if the integration is already known to need reconnection. */
export async function loadFreshIntercomCredentials(
  prisma: PrismaClient,
  integrationId: string,
): Promise<IntercomCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new IntercomReauthRequiredError();
  return current;
}

/**
 * IntercomClient's 401 fallback. Re-reads current credentials first: if
 * another process already reconnected the integration since our request was
 * made with `failedCredentials`, we just adopt that instead of marking it
 * dead a second time. Since Intercom issues no refresh token, a 401 is
 * unambiguous — there is no path back except the user reconnecting.
 */
export async function markReauthRequired(
  prisma: PrismaClient,
  integrationId: string,
  failedCredentials: IntercomCredentials,
): Promise<IntercomCredentials> {
  const current = await readCredentials(prisma, integrationId);
  if (current.reauthRequired) throw new IntercomReauthRequiredError();
  if (current.accessToken !== failedCredentials.accessToken) return current;

  await persistCredentialsIfUnchanged(prisma, integrationId, current, { ...current, reauthRequired: true });
  throw new IntercomReauthRequiredError();
}

/**
 * Stores the workspace id alongside the token. Compare-and-swap like
 * `markReauthRequired`, so it never clobbers a concurrent reconnect or
 * reauth flag — losing that race just means the next run records it.
 */
export async function recordIntercomWorkspaceId(
  prisma: PrismaClient,
  integrationId: string,
  current: IntercomCredentials,
  workspaceId: string,
): Promise<IntercomCredentials> {
  return persistCredentialsIfUnchanged(prisma, integrationId, current, { ...current, workspaceId });
}
