import * as Sentry from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "./src/lib/sentry-scrub";

/**
 * Loaded once by `src/instrumentation.ts` when `NEXT_RUNTIME === "edge"` —
 * covers `src/proxy.ts`, which runs on the Edge runtime by default and can
 * itself throw (e.g. a malformed session token). See `sentry.server.config.ts`
 * for why a missing `SENTRY_DSN` disables rather than skips `init`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  environment: process.env.NODE_ENV,
  // Keeps the legacy Jira webhook `?secret=` out of events (roadmap step 43).
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
});
