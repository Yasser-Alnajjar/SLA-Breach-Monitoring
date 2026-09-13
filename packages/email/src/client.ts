import nodemailer, { type Transporter } from "nodemailer";
import type { EmailConfig, EmailMessage } from "./types";

/** Generous enough for a slow SMTP relay, short enough that a settings-form "Test Connection" click (or a misconfigured/unreachable host) fails fast instead of hanging the request. */
const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Every other integration in this monorepo is a zero-dependency `fetch`
 * client (see `@sla/slack`), but SMTP is a stateful line-based protocol
 * `fetch` cannot speak — nodemailer is the one external dependency this
 * package carries for that reason. A transporter is created per call rather
 * than pooled/reused: the worker calls this at most once per notification
 * candidate per cycle, and the settings UI's test actions are one-shot, so
 * connection reuse isn't worth the added state.
 *
 * `security` maps onto Nodemailer's own options rather than the port —
 * see `EmailSecurity`'s doc comment for why the port is never used to infer
 * it.
 */
function createTransporter(config: EmailConfig): Transporter {
  const base = {
    host: config.host,
    port: config.port,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: CONNECTION_TIMEOUT_MS,
  };

  switch (config.security) {
    case "ssl_tls":
      return nodemailer.createTransport({ ...base, secure: true });
    case "none":
      return nodemailer.createTransport({ ...base, secure: false, ignoreTLS: true });
    case "starttls":
    default:
      return nodemailer.createTransport({ ...base, secure: false });
  }
}

function fromHeader(config: EmailConfig): string {
  return config.fromName ? `"${config.fromName.replace(/"/g, "'")}" <${config.from}>` : config.from;
}

/**
 * Authenticates against the configured SMTP server without sending
 * anything — the "Test Connection" action in the settings UI, and cheap
 * enough to also run before a real send if a caller wants to fail fast.
 * Deliberately separate from `sendEmail`: authentication succeeding is not
 * proof message delivery will (a relay can accept a login and still reject
 * or silently drop the actual send).
 */
export async function verifyEmailConfig(config: EmailConfig): Promise<void> {
  const transporter = createTransporter(config);
  await transporter.verify();
}

export async function sendEmail(config: EmailConfig, message: EmailMessage): Promise<void> {
  const transporter = createTransporter(config);

  await transporter.sendMail({
    from: fromHeader(config),
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
