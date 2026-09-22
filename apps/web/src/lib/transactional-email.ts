import { sendEmail, type EmailConfig, type EmailMessage } from "@sla/email";

/**
 * Deployment-level mailer for account-lifecycle email — invitations,
 * password resets, email verification (roadmap D8). Deliberately separate
 * from both `OrganizationEmailSettings` (per-org, opt-in, used only for SLA
 * breach/at-risk notifications) and `OPS_ALERT_SMTP_*` (worker-only, one
 * fixed operator recipient): these flows can fire before an organization
 * has ever configured its own SMTP — the very first invite, or a password
 * reset for an owner who never opened Settings → Notifications — so they
 * cannot depend on optional per-tenant configuration. `sendEmail` itself is
 * reused unchanged from `@sla/email`; only the config source is new.
 */

const REQUIRED_VARS = [
  "TRANSACTIONAL_SMTP_HOST",
  "TRANSACTIONAL_SMTP_USER",
  "TRANSACTIONAL_SMTP_PASSWORD",
  "TRANSACTIONAL_SMTP_FROM",
] as const;

/**
 * Thrown when one or more `TRANSACTIONAL_SMTP_*` variables are missing.
 * Deliberately not silent and not a fallback to `OrganizationEmailSettings`
 * — an account-lifecycle email (invite, password reset, verification) that
 * can't be sent must surface as a clear operational failure, not a quiet
 * no-op or a substitution the recipient never agreed their data should flow
 * through.
 */
export class TransactionalEmailNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Transactional email is not configured: missing ${missing.join(", ")}`);
    this.name = "TransactionalEmailNotConfiguredError";
  }
}

/**
 * Reads and validates `TRANSACTIONAL_SMTP_*` from the environment. Throws
 * `TransactionalEmailNotConfiguredError` when any required variable is
 * absent, rather than returning `null`/a partial config for a caller to
 * silently skip — unlike `apps/worker`'s `loadOpsAlertConfig` (an optional,
 * best-effort ops channel), an account-lifecycle email has no "skip and
 * move on" outcome that doesn't leave a user stuck.
 */
export function loadTransactionalEmailConfig(): EmailConfig {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new TransactionalEmailNotConfiguredError(missing);
  }

  return {
    host: process.env.TRANSACTIONAL_SMTP_HOST!,
    port: Number(process.env.TRANSACTIONAL_SMTP_PORT ?? 587),
    security: (process.env.TRANSACTIONAL_SMTP_SECURITY as EmailConfig["security"] | undefined) ?? "starttls",
    user: process.env.TRANSACTIONAL_SMTP_USER!,
    password: process.env.TRANSACTIONAL_SMTP_PASSWORD!,
    from: process.env.TRANSACTIONAL_SMTP_FROM!,
  };
}

/**
 * Sends one account-lifecycle email through the deployment's transactional
 * SMTP. A missing/invalid configuration is logged as a structured
 * operational error and rethrown — never swallowed — so the caller (e.g. an
 * invite API route) can surface a real failure to whoever triggered it
 * instead of reporting success for an email that was never sent.
 */
export async function sendTransactionalEmail(message: EmailMessage): Promise<void> {
  let config: EmailConfig;
  try {
    config = loadTransactionalEmailConfig();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "transactional_email_not_configured",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }

  try {
    await sendEmail(config, message);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "transactional_email_send_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}
