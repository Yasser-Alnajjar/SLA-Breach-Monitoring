import * as Sentry from "@sentry/nextjs";

/**
 * Next.js's blessed one-time-per-runtime startup hook (auto-loaded by the
 * App Router, no config flag needed) — the only place that can tell apart
 * the Node server runtime from the Edge runtime `proxy.ts` runs under, which
 * is why Sentry ships two separate init files rather than one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/** Captures a thrown/rejected server-side rendering or route-handler error that Next.js itself catches — the class of "unhandled exception" a try/catch inside a route can't see because it happens in Next's own request pipeline. */
export const onRequestError = Sentry.captureRequestError;
