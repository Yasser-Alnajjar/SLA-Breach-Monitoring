import { sendEmail, type EmailConfig } from "@sla/email";

/**
 * Deployment-owner-level alerting ("email/Slack to you, not the customer" —
 * roadmap step 29), which is why this is new, separate env-var-sourced
 * config rather than the per-organization `SlackIntegration`/
 * `OrganizationEmailSettings` models: those are customer-facing channels
 * for SLA breach notifications, and reusing them would mean paging every
 * customer's Slack channel when *our* worker stalls. `@sla/slack`'s
 * `postMessage` also can't be reused as-is here even if it could — it needs
 * a resolved OAuth bot token + channel id from a completed per-org Slack
 * app install, not a single ops channel — so Slack delivery below is a
 * plain incoming-webhook POST instead.
 */
export interface OpsAlertConfig {
  slackWebhookUrl: string | null;
  email: { to: string; smtp: EmailConfig } | null;
}

/** Returns null when neither channel is configured — callers treat that as "nothing to alert through" and skip the check entirely. */
export function loadOpsAlertConfig(): OpsAlertConfig | null {
  const slackWebhookUrl = process.env.OPS_ALERT_SLACK_WEBHOOK_URL ?? null;

  const to = process.env.OPS_ALERT_EMAIL ?? null;
  const smtpHost = process.env.OPS_ALERT_SMTP_HOST ?? null;
  const email: OpsAlertConfig["email"] =
    to && smtpHost
      ? {
          to,
          smtp: {
            host: smtpHost,
            port: Number(process.env.OPS_ALERT_SMTP_PORT ?? 587),
            security: (process.env.OPS_ALERT_SMTP_SECURITY as EmailConfig["security"] | undefined) ?? "starttls",
            user: process.env.OPS_ALERT_SMTP_USER ?? "",
            password: process.env.OPS_ALERT_SMTP_PASSWORD ?? "",
            from: process.env.OPS_ALERT_SMTP_FROM ?? to,
          },
        }
      : null;

  if (!slackWebhookUrl && !email) return null;
  return { slackWebhookUrl, email };
}

export interface OpsAlert {
  subject: string;
  message: string;
}

/**
 * Sends to every configured channel independently and best-effort: a
 * delivery failure here is logged (and would already have been captured to
 * Sentry by the caller, since the underlying condition is itself
 * alert-worthy) but never thrown — an ops alert about a stalled worker must
 * not itself crash the worker's watchdog loop.
 */
export async function sendOpsAlert(config: OpsAlertConfig | null, alert: OpsAlert): Promise<void> {
  if (!config) return;

  if (config.slackWebhookUrl) {
    try {
      const response = await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${alert.subject}*\n${alert.message}` }),
      });
      if (!response.ok) {
        console.error(JSON.stringify({ event: "ops_alert_slack_failed", status: response.status }));
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "ops_alert_slack_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  if (config.email) {
    try {
      await sendEmail(config.email.smtp, {
        to: [config.email.to],
        subject: alert.subject,
        text: alert.message,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "ops_alert_email_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
