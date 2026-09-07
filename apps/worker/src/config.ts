import type { EmailConfig } from "@sla/email";
import type { JiraOAuthConfig } from "@sla/jira";
import type { ZendeskOAuthConfig } from "@sla/zendesk";

/**
 * The worker runs unattended, so a missing provider config is not fatal: it
 * skips that provider and keeps polling the other one rather than crash-looping
 * an install that only connected one of the two systems. `email` follows the
 * same nullable pattern — an install that never set SMTP credentials just
 * gets no email channel, Slack (if connected) still fires.
 */
export interface WorkerConfig {
  zendesk: ZendeskOAuthConfig | null;
  jira: JiraOAuthConfig | null;
  email: EmailConfig | null;
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

function loadEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !user || !password || !from) return null;

  const rawPort = process.env.SMTP_PORT ?? "587";
  const port = Number(rawPort);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`SMTP_PORT must be a positive number, got "${rawPort}"`);
  }

  return { host, port, secure: process.env.SMTP_SECURE === "true", user, password, from };
}

export function loadWorkerConfig(): WorkerConfig {
  const appUrl = process.env.NEXTAUTH_URL;
  const zendeskClientId = process.env.ZENDESK_CLIENT_ID;
  const zendeskClientSecret = process.env.ZENDESK_CLIENT_SECRET;
  const jiraClientId = process.env.JIRA_CLIENT_ID;
  const jiraClientSecret = process.env.JIRA_CLIENT_SECRET;

  return {
    zendesk:
      appUrl && zendeskClientId && zendeskClientSecret
        ? {
            clientId: zendeskClientId,
            clientSecret: zendeskClientSecret,
            redirectUri: `${appUrl}/api/integrations/zendesk/callback`,
          }
        : null,
    jira:
      appUrl && jiraClientId && jiraClientSecret
        ? {
            clientId: jiraClientId,
            clientSecret: jiraClientSecret,
            redirectUri: `${appUrl}/api/integrations/jira/callback`,
          }
        : null,
    email: loadEmailConfig(),
    activePollMs: readIntervalMs("WORKER_ACTIVE_POLL_MS", DEFAULT_ACTIVE_POLL_MS),
    reconciliationMs: readIntervalMs("WORKER_RECONCILIATION_MS", DEFAULT_RECONCILIATION_MS),
  };
}
