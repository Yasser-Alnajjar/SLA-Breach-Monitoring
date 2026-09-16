/**
 * Origin-header CSRF check for state-changing API requests (roadmap step
 * 33). Defense in depth on top of NextAuth's `SameSite=Lax` session cookie:
 * Lax already keeps the cookie off cross-site `fetch`/form POSTs in modern
 * browsers, but it doesn't cover same-site-but-cross-origin callers (e.g. a
 * compromised sibling subdomain) or older browsers with different defaults.
 *
 * Every state-changing call this app's own UI makes is a same-origin
 * `fetch`, and browsers always attach `Origin` to non-GET/HEAD fetches, so
 * requiring it to match costs legitimate users nothing.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isStateChangingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function originOf(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * True when the request's `Origin` (falling back to `Referer`'s origin, for
 * the rare client that strips `Origin`) is this app. Fails closed: no
 * parseable origin at all is rejected, since a session-cookie-authenticated
 * route has no legitimate caller that can't send one.
 *
 * "This app" is either `NEXTAUTH_URL`'s origin (the canonical public URL —
 * see `@/lib/app-url`) or the host the request was actually addressed to
 * (`X-Forwarded-Host` behind the reverse proxy, else `Host`), which keeps
 * `next dev` working over a LAN IP or tunnel from `allowedDevOrigins`.
 * Trusting those headers is safe for CSRF specifically: a cross-site page
 * can't forge them on a victim's browser request, and a non-browser client
 * that can forge them doesn't hold the victim's cookie.
 */
export function isSameOriginRequest(
  request: Request,
  appUrl: string | undefined,
): boolean {
  const requestOrigin =
    originOf(request.headers.get("origin")) ??
    (request.headers.has("origin")
      ? null
      : originOf(request.headers.get("referer")));
  if (!requestOrigin) return false;

  const appOrigin = originOf(appUrl ?? null);
  if (appOrigin && requestOrigin === appOrigin) return true;

  const addressedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  return !!addressedHost && new URL(requestOrigin).host === addressedHost;
}
