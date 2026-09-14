/**
 * Basic in-memory rate limiter (roadmap step 30) for the handful of routes
 * reachable without a session — `/api/sign-up`,
 * `/api/auth/callback/credentials`, and `/api/webhooks/**` — where nothing
 * currently slows down high-volume secret-guessing or credential-stuffing.
 * Deliberately not backed by Redis or any shared store:
 * `docker-compose.prod.yml` runs exactly one `web` container, so an
 * in-process counter is enough to blunt abuse from a single source without
 * adding infrastructure this deployment doesn't otherwise need — a
 * general-purpose rate-limiting gateway for every route is this step's own
 * explicit non-goal.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Keeps `buckets` from growing unbounded under sustained traffic from many
// distinct keys. Swept opportunistically on access rather than on a timer,
// since this runs inside Next's proxy (Edge runtime middleware has no
// background-task facility to lean on).
let checksSinceSweep = 0;
const SWEEP_EVERY = 500;

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying — only set when `allowed` is false. */
  retryAfterSeconds?: number;
}

/**
 * Fixed-window counter: `limit` requests per `windowMs` per `key`. Good
 * enough to slow down a scanner, not a precise token bucket — matches this
 * step's own "basic rate limiting" scope.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  checksSinceSweep += 1;
  if (checksSinceSweep >= SWEEP_EVERY) {
    checksSinceSweep = 0;
    sweepExpired(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Test-only escape hatch — resets all counters between test cases. */
export function _resetRateLimitState(): void {
  buckets.clear();
  checksSinceSweep = 0;
}

/**
 * Best-effort client IP from the reverse proxy this deployment expects in
 * front of `web` (see docs/deployment.md's security notes). Falls back to a
 * single shared bucket when neither header is present — e.g. local dev with
 * no proxy in front — which just means those callers share one limit
 * instead of being unthrottled.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
