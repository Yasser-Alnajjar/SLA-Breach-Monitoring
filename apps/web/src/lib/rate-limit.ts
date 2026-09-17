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
 * Client IP as seen by the reverse proxy this deployment expects in front of
 * `web` (see docs/deployment.md's security notes).
 *
 * Reads `X-Forwarded-For` from the right, never the left. nginx
 * (`$proxy_add_x_forwarded_for`), Traefik and Caddy all append the address
 * that connected to them, but pass along whatever the client already put in
 * the header. So the leftmost entry is client-controlled, and keying on it let
 * a caller rotate a fake IP per request and never hit a limit (found in
 * roadmap step 41's live check). With `TRUSTED_PROXY_COUNT` proxies in front
 * (default 1; set 2 for e.g. a CDN in front of Caddy), the entry that many
 * places from the right is the last address a trusted proxy saw.
 *
 * `X-Real-IP` is only used when there's no `X-Forwarded-For`. Falls back to
 * one shared bucket when neither is present (local dev with no proxy), so
 * those callers share one limit instead of going unthrottled. None of this
 * helps if clients can reach `web` directly, which is why
 * `docker-compose.prod.yml` binds its port to 127.0.0.1 by default.
 */
export function clientIpFromHeaders(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined,
  trustedProxyCount: number = readTrustedProxyCount(),
): string {
  if (forwardedFor) {
    const entries = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    // Fewer entries than trusted proxies means the chain is shorter than
    // configured; the leftmost is then the closest thing to the client.
    const ip = entries[Math.max(0, entries.length - trustedProxyCount)];
    if (ip) return ip;
  }
  if (realIp) return realIp;
  return "unknown";
}

function readTrustedProxyCount(): number {
  const parsed = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export function getClientIp(request: Request): string {
  return clientIpFromHeaders(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
}
