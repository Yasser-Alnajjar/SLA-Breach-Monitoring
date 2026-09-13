import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PAGE_PATHS = [
  "/",
  "/docs",
  "/pricing",
  "/about",
  "/sign-in",
  "/sign-up",
];

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) =>
      pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public pages don't require authentication.
  if (matchesPath(pathname, PUBLIC_PAGE_PATHS)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Everything else requires authentication.
  if (token) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("callbackUrl", pathname);

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
