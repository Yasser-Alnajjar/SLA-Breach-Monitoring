import type { PrismaClient } from "@sla/db";

/**
 * Thrown by `assertSessionStillValid` — see that function's doc comment
 * for how `auth.ts`'s `jwt` callback turns this into a cleared session.
 * A named class (rather than a bare `Error`) mainly so
 * `next-auth`'s own `logger.error("JWT_SESSION_ERROR", error)` call
 * (inside its `session` route handler) logs a distinguishable name instead
 * of a generic "Error" for every unrelated failure that route can hit.
 */
export class SessionInvalidatedError extends Error {
  constructor() {
    super("This session is no longer valid");
    this.name = "SessionInvalidatedError";
  }
}

/**
 * Re-validates a live JWT against the database (roadmap 5.7) — called from
 * `auth.ts`'s `jwt` callback on every request that isn't the initial
 * sign-in (`user` unset), never at sign-in itself (the token was just
 * built from a fresh row, nothing to re-check yet).
 *
 * Two conditions make a previously-issued token invalid:
 *   1. The user no longer exists (removed — roadmap 5.3/5.4's member
 *      removal is a hard delete, so "no such user" *is* the removal
 *      signal; no separate flag to set).
 *   2. `sessionVersion` on the row has moved past what's baked into this
 *      token (a password change or reset — see `/api/me/password` and
 *      `@sla/db`'s `resetPassword`, both of which increment it).
 *
 * Throws `SessionInvalidatedError` for either — extracted into its own
 * function (rather than inlined in the callback) so this DB-dependent
 * logic is unit-testable without exercising NextAuth's own callback
 * machinery.
 */
export async function assertSessionStillValid(
  prisma: PrismaClient,
  token: { userId: string; sessionVersion: number },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { sessionVersion: true },
  });
  if (!user || user.sessionVersion !== token.sessionVersion) {
    throw new SessionInvalidatedError();
  }
}
