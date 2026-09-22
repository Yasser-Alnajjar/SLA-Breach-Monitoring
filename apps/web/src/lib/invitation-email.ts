import type { EmailMessage } from "@sla/email";
import { INVITATION_TTL_MS } from "@sla/db";
import { getAppUrl } from "@/lib/app-url";

const INVITATION_TTL_DAYS = INVITATION_TTL_MS / (24 * 60 * 60 * 1000);

export function invitationAcceptUrl(token: string): string {
  const url = new URL("/invite/accept", getAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildInvitationEmail(input: {
  to: string;
  organizationName: string;
  token: string;
}): EmailMessage {
  const acceptUrl = invitationAcceptUrl(input.token);
  return {
    to: [input.to],
    subject: `You've been invited to join ${input.organizationName} on Elapsed`,
    text: [
      `You've been invited to join ${input.organizationName} on Elapsed.`,
      "",
      `Accept the invitation: ${acceptUrl}`,
      "",
      `This link is single-use and expires in ${INVITATION_TTL_DAYS} days.`,
    ].join("\n"),
  };
}
