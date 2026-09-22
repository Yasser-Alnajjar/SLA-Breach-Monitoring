import type { EmailMessage } from "@sla/email";
import { EMAIL_VERIFICATION_TTL_MS } from "@sla/db";
import { getAppUrl } from "@/lib/app-url";

const EMAIL_VERIFICATION_TTL_HOURS = EMAIL_VERIFICATION_TTL_MS / (60 * 60 * 1000);

export function emailVerificationUrl(token: string): string {
  const url = new URL("/verify-email", getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

/** Sent to the account's current email — confirms it at sign-up (or on a resend). */
export function buildEmailVerificationEmail(input: { to: string; token: string }): EmailMessage {
  const verifyUrl = emailVerificationUrl(input.token);
  return {
    to: [input.to],
    subject: "Verify your email for Elapsed",
    text: [
      "Confirm this is your email address to finish setting up Elapsed.",
      "",
      `Verify your email: ${verifyUrl}`,
      "",
      `This link is single-use and expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    ].join("\n"),
  };
}

/** Sent to the *new* address a "change email" request targets — the change never applies until this link is clicked. */
export function buildEmailChangeVerificationEmail(input: { to: string; token: string }): EmailMessage {
  const verifyUrl = emailVerificationUrl(input.token);
  return {
    to: [input.to],
    subject: "Confirm your new email for Elapsed",
    text: [
      "We received a request to change the email on an Elapsed account to this address.",
      "",
      `Confirm this change: ${verifyUrl}`,
      "",
      `This link is single-use and expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours.`,
      "",
      "If you didn't request this, you can safely ignore this email — the account's email won't change.",
    ].join("\n"),
  };
}
