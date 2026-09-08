import type { EmailConfig } from "@sla/email";

/**
 * Mirrors `apps/worker/src/config.ts`'s `loadEmailConfig` exactly: the same
 * ops-level SMTP credential, read a second time here because the webhook
 * receiver (roadmap step 20) runs the notification pipeline itself rather
 * than waiting for the next worker cycle. Missing credentials mean the email
 * channel is skipped, not a crash — same nullable pattern as the worker's.
 */
export function getEmailConfig(): EmailConfig | null {
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
