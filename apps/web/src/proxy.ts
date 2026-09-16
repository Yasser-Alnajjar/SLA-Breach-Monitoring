import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { encodeCredentialsRateLimitError } from "@/lib/auth-rate-limit";
import { isSameOriginRequest, isStateChangingMethod } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Pages anyone can reach with no session: the docs site and the two auth
 * screens. Everything else under the app (dashboard, cases, settings,
 * onboarding, and their API routes) requires a signed-in user.
 */
const PUBLIC_PAGE_PATHS = ["/", "/docs", "/about", "/pricing"];
const AUTH_PAGE_PATHS = ["/sign-in", "/sign-up"];

/**
 * API routes that authenticate themselves rather than via the session
 * cookie: NextAuth's own endpoints (the login mechanism itself), account
 * creation, inbound provider webhooks (Zendesk/Jira call these directly and
 * carry their own bearer token/secret, never a browser session), and the
 * health check (an uptime monitor or container orchestrator has no session
 * cookie either, and needs no org context — it only checks DB connectivity).
 */
const PUBLIC_API_PATHS = [
  "/api/auth",
  "/api/sign-up",
  "/api/webhooks",
  "/api/health",
];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Rate limits scoped to exactly the unauthenticated-by-session routes named
 * in roadmap step 30: the two webhook receivers (external providers call
 * these directly, at low legitimate volume, so a generous cap mostly just
 * slows down secret-guessing), account creation, and the credentials
 * sign-in callback (NextAuth's Credentials provider has no throttling of
 * its own). `/api/auth`'s other paths — session/csrf/providers lookups the
 * client calls on every page load — are deliberately left unthrottled here.
 */
interface RateLimitRule {
  match: (pathname: string) => boolean;
  bucket: string;
  limit: number;
  windowMs: number;
  /**
   * Only the credentials callback needs this: `next-auth/react`'s `signIn()`
   * always reads `error` out of a `url` field on the response body (see
   * `@/lib/auth-rate-limit`'s doc comment), so a generic `{ error }` body
   * would make its internal `new URL(data.url)` call throw. Defaults to the
   * plain body every other rate-limited route uses.
   */
  buildBody?: (
    request: NextRequest,
    retryAfterSeconds: number,
  ) => Record<string, unknown>;
}

const RATE_LIMITS: RateLimitRule[] = [
  {
    match: (p) => matchesPath(p, ["/api/webhooks"]),
    bucket: "webhook",
    limit: 60,
    windowMs: 60_000,
  },
  {
    match: (p) => p === "/api/sign-up",
    bucket: "sign-up",
    limit: 5,
    windowMs: 15 * 60_000,
  },
  {
    match: (p) => p === "/api/auth/callback/credentials",
    bucket: "sign-in",
    limit: 10,
    windowMs: 2 * 60_000,
    buildBody: (request, retryAfterSeconds) => {
      const url = new URL(request.url);
      url.search = new URLSearchParams({
        error: encodeCredentialsRateLimitError(retryAfterSeconds),
      }).toString();
      return { url: url.toString() };
    },
  },
];

/**
 * API routes exempt from the Origin check (roadmap step 33). Webhooks are
 * called server-to-server by Zendesk/Jira with no `Origin` header and no
 * session cookie — they authenticate via their own secret. NextAuth's
 * endpoints already enforce their own double-submit CSRF token. Every other
 * state-changing `/api` request — `/api/settings/**`, integration
 * config/disconnect/backfill, Slack channel selection, and sign-up — is
 * session-cookie (or login) driven and must come from this app's own origin.
 */
const CSRF_EXEMPT_API_PATHS = ["/api/webhooks", "/api/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const rateLimit = RATE_LIMITS.find((rule) => rule.match(pathname));
  if (rateLimit) {
    const key = `${rateLimit.bucket}:${getClientIp(request)}`;
    const result = checkRateLimit(key, rateLimit.limit, rateLimit.windowMs);
    if (!result.allowed) {
      const retryAfterSeconds = result.retryAfterSeconds ?? 60;
      const body = rateLimit.buildBody?.(request, retryAfterSeconds) ?? {
        error: "Too many requests",
      };
      return NextResponse.json(body, {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      });
    }
  }

  if (
    pathname.startsWith("/api/") &&
    isStateChangingMethod(request.method) &&
    !matchesPath(pathname, CSRF_EXEMPT_API_PATHS) &&
    !isSameOriginRequest(request, process.env.NEXTAUTH_URL)
  ) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  if (
    matchesPath(pathname, PUBLIC_API_PATHS) ||
    matchesPath(pathname, PUBLIC_PAGE_PATHS)
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (matchesPath(pathname, AUTH_PAGE_PATHS)) {
    // A signed-in user doesn't need the sign-in/sign-up screens again.
    if (token) return NextResponse.redirect(new URL("/dashboard", getAppUrl()));
    return NextResponse.next();
  }

  if (token) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const signInUrl = new URL("/sign-in", getAppUrl());
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
