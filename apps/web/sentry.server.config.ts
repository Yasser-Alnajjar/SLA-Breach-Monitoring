import * as Sentry from "@sentry/nextjs";

/**
 * Loaded once by `src/instrumentation.ts` when `NEXT_RUNTIME === "nodejs"`.
 * A missing `SENTRY_DSN` disables the SDK outright (`enabled: false`)
 * rather than skipping `init` altogether, so every `Sentry.captureException`
 * call site downstream (this file's sibling `sentry.edge.config.ts`, the
 * `/api/health` route, `onRequestError` below) stays a plain, unconditional
 * call — no per-call-site "is Sentry configured" branching anywhere.
 * `tracesSampleRate: 0`: this step is error tracking, not the "full
 * APM/tracing" the roadmap explicitly excludes.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
});
