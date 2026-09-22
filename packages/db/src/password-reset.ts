import type { PrismaClient } from "../generated/prisma/client";
import { generateSecureToken, hashToken } from "./secure-token";
import { normalizeEmail } from "./invitations";

/**
 * 1 hour — much shorter than an invitation's 7 days (see
 * `INVITATION_TTL_MS`): this token grants account takeover on its own
 * (no second factor), so the window a leaked/intercepted email link stays
 * valid is kept tight rather than "convenient to click later".
 */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export class PasswordResetTokenNotFoundError extends Error {
  constructor() {
    super("This reset link is invalid");
    this.name = "PasswordResetTokenNotFoundError";
  }
}

export class PasswordResetTokenExpiredError extends Error {
  constructor() {
    super("This reset link has expired");
    this.name = "PasswordResetTokenExpiredError";
  }
}

/** Thrown when the token exists but was already consumed — same "can't tell why from the outside" shape as `InvitationNotPendingError`. */
export class PasswordResetTokenUsedError extends Error {
  constructor() {
    super("This reset link has already been used");
    this.name = "PasswordResetTokenUsedError";
  }
}

export interface RequestPasswordResetResult {
  userId: string;
  /** The raw token — exists only here and in the email built from it. Never persisted. */
  token: string;
}

/**
 * Looks up the user by (normalized) email and issues a fresh reset token,
 * or returns `null` if no account has that email. Returning `null` rather
 * than throwing is deliberate: the caller (the `/api/password-reset` route)
 * must respond identically either way — a distinguishable error here would
 * make this a user-enumeration oracle, the same concern `auth.ts`'s
 * `DUMMY_PASSWORD_HASH` exists to close for sign-in.
 *
 * Deletes any of this user's prior unused tokens before creating the new
 * one (unlike `createOrResendInvitation`, which rotates a single row) —
 * simpler than tracking a "superseded" state, and it means a second
 * "forgot password" click makes any earlier email link stop working
 * immediately, matching what a user clicking "resend" expects.
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
): Promise<RequestPasswordResetResult | null> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true },
  });
  if (!user) return null;

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  // Interactive form (not the array form) to match this codebase's one
  // established `$transaction` convention (`acceptInvitation`) — keeps
  // every transaction here testable against the same in-memory fake.
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
  });

  return { userId: user.id, token };
}

export interface ResetPasswordResult {
  userId: string;
}

/**
 * Validates the token, its expiry, and that it hasn't already been used,
 * then atomically claims it and updates the user's password — both succeed
 * or both roll back. Single-use/race-safety follows `acceptInvitation`'s
 * exact shape: the token is claimed inside the transaction via a
 * conditional `updateMany` (`WHERE usedAt IS NULL`), so if two reset
 * attempts for the same token run concurrently, only one ever gets past the
 * claim and updates the password.
 */
export async function resetPassword(
  prisma: PrismaClient,
  input: { token: string; passwordHash: string },
): Promise<ResetPasswordResult> {
  const tokenHash = hashToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record) throw new PasswordResetTokenNotFoundError();
  if (record.usedAt) throw new PasswordResetTokenUsedError();
  if (record.expiresAt <= new Date()) throw new PasswordResetTokenExpiredError();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) throw new PasswordResetTokenUsedError();

    await tx.user.update({
      where: { id: record.userId },
      // `sessionVersion` increment signs out every live session for this
      // account (roadmap 5.7) — whoever forgot this password may have
      // done so because someone else is in their account.
      data: { passwordHash: input.passwordHash, sessionVersion: { increment: 1 } },
    });

    return { userId: record.userId };
  });
}
