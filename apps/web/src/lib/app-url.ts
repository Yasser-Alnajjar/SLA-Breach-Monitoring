/**
 * Base URL for building absolute redirects. Self-hosted deployments (see
 * apps/web/Dockerfile) set HOSTNAME=0.0.0.0 so the Next server's standalone
 * runtime accepts connections from outside the container — but Next reuses
 * that same HOSTNAME to build the request's absolute URL, so anything built
 * from `request.url` (e.g. `new URL("/sign-in", request.url)`) silently
 * inherits host 0.0.0.0 regardless of the Host header the browser actually
 * sent. NEXTAUTH_URL is the one env var guaranteed to hold the real
 * public-facing origin, so redirects must be anchored to it instead.
 */
export function getAppUrl(): string {
  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl) throw new Error("NEXTAUTH_URL is not configured");
  return appUrl;
}
