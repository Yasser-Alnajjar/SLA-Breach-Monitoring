import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/app-url";

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
 * creation, and inbound provider webhooks (Zendesk/Jira call these directly
 * and carry their own bearer token/secret, never a browser session).
 */
const PUBLIC_API_PATHS = ["/api/auth", "/api/sign-up", "/api/webhooks"];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
