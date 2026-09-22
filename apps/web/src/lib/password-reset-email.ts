import type { EmailMessage } from "@sla/email";
import { PASSWORD_RESET_TTL_MS } from "@sla/db";
import { getAppUrl } from "@/lib/app-url";

const PASSWORD_RESET_TTL_MINUTES = PASSWORD_RESET_TTL_MS / (60 * 1000);

export function passwordResetUrl(token: string): string {
  const url = new URL("/reset-password", getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildPasswordResetEmail(input: { to: string; token: string }): EmailMessage {
  const resetUrl = passwordResetUrl(input.token);
  return {
    to: [input.to],
    subject: "Reset your Elapsed password",
    text: [
      "We received a request to reset your Elapsed password.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      `This link is single-use and expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      "",
      "If you didn't request this, you can safely ignore this email — your password won't change.",
    ].join("\n"),
  };
}
