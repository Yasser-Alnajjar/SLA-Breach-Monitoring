/**
 * Progressive throttling for repeated *failed* credentials sign-ins,
 * layered on top of `rate-limit.ts`'s IP-level fixed window (`proxy.ts`).
 * The IP limit slows down a scanner hammering the endpoint; this slows down
 * repeated guesses against one specific login identity, including from
 * behind a shared/rotating IP.
 *
 * Deliberately a separate in-memory map rather than an extension of
 * `checkRateLimit`: that limiter counts *requests* in a fixed window, while
 * this tracks *consecutive failures* per identity and clears on success —
 * a different enough shape that bolting it onto the counter would just
 * make both harder to read. Same "single `web` container, no Redis" premise
 * as `rate-limit.ts`.
 *
 * Callers (see `@/lib/auth.ts`) are expected to:
 *   1. Look up `checkAuthThrottle` for the identity *before* touching the
 *      database or comparing a password, so a cooldown blocks the attempt
 *      without doing any real credential check.
 *   2. Call `recordFailedAuthAttempt` only after an actual failed
 *      credentials check (wrong password, or no such user) — never for a
 *      request that never reached that check.
 *   3. Call `clearAuthThrottle` on a successful sign-in.
 */

interface IdentityState {
  failures: number;
  /** Epoch ms until which new attempts are throttled; 0 when not in cooldown. */
  cooldownUntil: number;
  /** Epoch ms after which this record is treated as stale and dropped. */
  expiresAt: number;
}

const IDLE_RESET_MS = 15 * 60_000;

/** First 3 failures are free; the 4th+ each add a modest, predictable delay. */
const FREE_FAILURES = 3;
const DELAY_SECONDS_BY_EXTRA_FAILURE = [2, 5, 10, 20, 30];
const MAX_DELAY_SECONDS = 60;

function delaySecondsForFailureCount(failures: number): number {
  const extra = failures - FREE_FAILURES;
  if (extra <= 0) return 0;
  return DELAY_SECONDS_BY_EXTRA_FAILURE[extra - 1] ?? MAX_DELAY_SECONDS;
}

const identities = new Map<string, IdentityState>();

// Same opportunistic-sweep approach as `rate-limit.ts` — see that file's
// comment for why (no background-task facility in this runtime).
let checksSinceSweep = 0;
const SWEEP_EVERY = 500;

function sweepExpired(now: number): void {
  for (const [key, state] of identities) {
    if (state.expiresAt <= now) identities.delete(key);
  }
}

/** trim + lowercase — the only form this module ever stores or looks up. */
export function normalizeLoginIdentity(email: string): string {
  return email.trim().toLowerCase();
}

export interface AuthThrottleStatus {
  throttled: boolean;
  /** Only set when `throttled` is true. */
  retryAfterSeconds?: number;
}

export function checkAuthThrottle(
  identity: string,
  now: number = Date.now(),
): AuthThrottleStatus {
  checksSinceSweep += 1;
  if (checksSinceSweep >= SWEEP_EVERY) {
    checksSinceSweep = 0;
    sweepExpired(now);
  }

  const state = identities.get(identity);
  if (!state || state.expiresAt <= now || state.cooldownUntil <= now) {
    return { throttled: false };
  }
  return {
    throttled: true,
    retryAfterSeconds: Math.max(1, Math.ceil((state.cooldownUntil - now) / 1000)),
  };
}

/** Call only after a credentials attempt for `identity` has actually failed. */
export function recordFailedAuthAttempt(identity: string, now: number = Date.now()): void {
  const existing = identities.get(identity);
  const stillFresh = existing && existing.expiresAt > now;
  const failures = (stillFresh ? existing.failures : 0) + 1;
  const delaySeconds = delaySecondsForFailureCount(failures);

  identities.set(identity, {
    failures,
    cooldownUntil: delaySeconds > 0 ? now + delaySeconds * 1000 : 0,
    expiresAt: now + IDLE_RESET_MS,
  });
}

/** Call on a successful sign-in — a real login must not stay throttled. */
export function clearAuthThrottle(identity: string): void {
  identities.delete(identity);
}

/** Test-only escape hatch — resets all identity state between test cases. */
export function _resetAuthThrottleState(): void {
  identities.clear();
  checksSinceSweep = 0;
}
