import { createHash, randomBytes } from "node:crypto";

/**
 * Shared primitive behind every single-use security token this app hands to
 * an email address rather than an authenticated session: organization
 * invitations (roadmap 5.2), and designed so password reset (5.5) and email
 * verification (5.6) can reuse it against their own tables instead of each
 * growing their own token handling.
 */

/** 256 bits — generous enough that guessing is not a credible attack even against an unbounded number of attempts. */
const TOKEN_BYTES = 32;

/**
 * A cryptographically random, URL-safe token. Hand this to the caller
 * exactly once (the acceptance URL/email) — never store it. Store
 * `hashToken(token)` instead.
 */
export function generateSecureToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * SHA-256 of the raw token — deliberately not a slow/salted password hash
 * (bcrypt/scrypt): the token already carries 256 bits of entropy, so
 * there's nothing left for a slow hash to protect against, and a fast hash
 * keeps a token lookup (`WHERE tokenHash = ?`) a plain indexed equality
 * query rather than an expensive per-row comparison. Only this hash is ever
 * persisted — the raw token exists solely in the URL emailed to the
 * recipient, so a database read (backup, replica, leaked dump) never
 * exposes a usable token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
