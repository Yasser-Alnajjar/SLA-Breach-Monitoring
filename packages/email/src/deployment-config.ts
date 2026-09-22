import type { EmailConfig } from "./types";

/**
 * Deployment-owned SMTP, shared by every deployment-level email concern:
 * account-lifecycle mail sent from apps/web (invitations, password resets,
 * email verification — roadmap D8) and apps/worker's stalled-cycle ops
 * alert. Kept distinct from `OrganizationEmailSettings` (per-org, opt-in,
 * customer-owned, used only for SLA breach/at-risk notifications) — that
 * boundary is the one that matters. A second deployment-owned SMTP
 * transport alongside this one isn't: both consumers already go through
 * the same `sendEmail`/`EmailConfig` below, so there's no technical reason
 * to duplicate the credentials that feed it. Deliberately kept in this
 * package rather than duplicated in `apps/web` and `apps/worker` — both
 * already depend on `@sla/email` for the transport itself, and this is the
 * one config source both now share. Still a separate file/export from
 * `client.ts`: this package stays a plain Nodemailer wrapper for `sendEmail`
 * itself, with config loading kept to its own concern.
 */

const REQUIRED_VARS = ["DEPLOYMENT_SMTP_HOST", "DEPLOYMENT_SMTP_USER", "DEPLOYMENT_SMTP_PASSWORD", "DEPLOYMENT_SMTP_FROM"] as const;

/**
 * Thrown when one or more `DEPLOYMENT_SMTP_*` variables are missing. A
 * caller for whom this is optional (e.g. the worker's ops alert, which
 * treats "not configured" as "skip this channel") should catch this
 * specific error rather than assuming any throw means that; a caller for
 * whom it's required (e.g. sending an invite) should let it propagate.
 */
export class DeploymentSmtpNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Deployment SMTP is not configured: missing ${missing.join(", ")}`);
    this.name = "DeploymentSmtpNotConfiguredError";
  }
}

/**
 * Reads and validates `DEPLOYMENT_SMTP_*` from the environment. Throws
 * `DeploymentSmtpNotConfiguredError` when any required variable is absent,
 * rather than returning `null`/a partial config — callers for whom that's
 * an expected, skippable state (not every deployment needs email-based ops
 * alerts) catch the specific error type instead.
 */
export function loadDeploymentSmtpConfig(): EmailConfig {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new DeploymentSmtpNotConfiguredError(missing);
  }

  return {
    host: process.env.DEPLOYMENT_SMTP_HOST!,
    port: Number(process.env.DEPLOYMENT_SMTP_PORT ?? 587),
    security: (process.env.DEPLOYMENT_SMTP_SECURITY as EmailConfig["security"] | undefined) ?? "starttls",
    user: process.env.DEPLOYMENT_SMTP_USER!,
    password: process.env.DEPLOYMENT_SMTP_PASSWORD!,
    from: process.env.DEPLOYMENT_SMTP_FROM!,
  };
}
