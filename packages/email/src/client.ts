import nodemailer from "nodemailer";
import type { EmailConfig, EmailMessage } from "./types";

/**
 * Every other integration in this monorepo is a zero-dependency `fetch`
 * client (see `@sla/slack`), but SMTP is a stateful line-based protocol
 * `fetch` cannot speak — nodemailer is the one external dependency this
 * package carries for that reason. A transporter is created per send rather
 * than pooled/reused: the worker calls this at most once per notification
 * candidate per cycle, so connection reuse isn't worth the added state.
 */
export async function sendEmail(config: EmailConfig, message: EmailMessage): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  await transporter.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
