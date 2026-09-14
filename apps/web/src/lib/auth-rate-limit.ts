import type { SignInResponse } from "next-auth/react";

/**
 * Bridges the server-authoritative rate limit on
 * `/api/auth/callback/credentials` (`proxy.ts`'s `RATE_LIMITS`, roadmap
 * step 30) across `next-auth/react`'s client `signIn()`. That function's
 * `SignInResponse` drops everything from the response body except an
 * `error` string it parses out of a `url` field — its implementation always
 * runs `new URL(data.url).searchParams.get("error")` for a credentials
 * provider with `redirect: false`, regardless of the response status. A
 * plain `{ error: "..." }` 429 body (fine for the other two rate-limited
 * routes, which don't go through `signIn()`) has no `url` field, so
 * `new URL(undefined)` throws — that's the "Invalid URL" crash this file
 * exists to route around.
 *
 * `proxy.ts` instead gives this one route's 429 response a `url` whose
 * `error` query param is `encodeCredentialsRateLimitError`'s output; the
 * already-computed `Retry-After` seconds ride inside that string, so the
 * client never recomputes or guesses the cooldown. `interpretCredentialsSignInResult`
 * decodes it back into a stable shape for the sign-in UI; every other error
 * (e.g. a wrong password's "CredentialsSignin") passes through unchanged.
 */
const RATE_LIMITED_ERROR_CODE = "RATE_LIMITED";

/** Used only by `proxy.ts` when crafting the 429 response body for this route. */
export function encodeCredentialsRateLimitError(retryAfterSeconds: number): string {
  return `${RATE_LIMITED_ERROR_CODE}:${Math.max(1, Math.round(retryAfterSeconds))}`;
}

export type SignInOutcome =
  | { ok: true }
  | { ok: false; error: "RATE_LIMITED"; retryAfterSeconds: number }
  | { ok: false; error: string };

/**
 * `result` is `undefined` when `signIn()`'s own `getProviders()` call fails
 * before it ever reaches our route — a distinct, unrelated failure mode,
 * surfaced here as a generic error rather than special-cased.
 */
export function interpretCredentialsSignInResult(result: SignInResponse | undefined): SignInOutcome {
  if (!result) return { ok: false, error: "Unable to sign in right now" };
  if (!result.error) return { ok: true };

  const match = /^RATE_LIMITED:(\d+)$/.exec(result.error);
  if (match) {
    return { ok: false, error: "RATE_LIMITED", retryAfterSeconds: Number(match[1]) };
  }

  return { ok: false, error: result.error };
}

/** "4 minutes 47 seconds" / "5 minutes" / "47 seconds" — singular-aware, never negative. */
export function formatCooldownSentence(remainingSeconds: number): string {
  const total = Math.max(0, Math.ceil(remainingSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  if (minutes === 0) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  if (seconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
}

/** "04:47" live-countdown clock format. */
export function formatCooldownClock(remainingSeconds: number): string {
  const total = Math.max(0, Math.ceil(remainingSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
