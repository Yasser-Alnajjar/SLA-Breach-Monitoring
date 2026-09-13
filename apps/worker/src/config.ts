/**
 * The worker runs unattended, so a missing provider config is not fatal: it
 * skips that provider and keeps polling the other one rather than crash-looping
 * an install that only connected one of the two systems.
 *
 * Zendesk/Jira OAuth app config, and now SMTP email configuration too, used
 * to live here — loaded once globally from env at startup. Both are now
 * per-organization (settings UI): OAuth app config lives in
 * `IntegrationConfig`, SMTP in `OrganizationEmailSettings`. `cycle.ts`
 * resolves the former per organization via `@sla/db`'s
 * `getIntegrationConfig` and the latter inside `runNotificationPipeline`
 * itself (`@sla/notifications`) — `appUrl` is all this config needs to pass
 * down, to build each provider's redirect URI.
 */
export interface WorkerConfig {
  appUrl: string | null;
  activePollMs: number;
  reconciliationMs: number;
}

const DEFAULT_ACTIVE_POLL_MS = 5 * 60 * 1000;
const DEFAULT_RECONCILIATION_MS = 60 * 60 * 1000;

function readIntervalMs(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds, got "${raw}"`);
  }
  return parsed;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    appUrl: process.env.NEXTAUTH_URL ?? null,
    activePollMs: readIntervalMs("WORKER_ACTIVE_POLL_MS", DEFAULT_ACTIVE_POLL_MS),
    reconciliationMs: readIntervalMs("WORKER_RECONCILIATION_MS", DEFAULT_RECONCILIATION_MS),
  };
}
