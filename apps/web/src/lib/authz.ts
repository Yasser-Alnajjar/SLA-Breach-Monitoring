import type { Session } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Emails of the platform operators who run this deployment — not an
 * organization role (see `UserRole`; no tenant, including an org owner, is
 * ever a platform operator). Comma-separated, matched case-insensitively.
 */
function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformOperator(session: Session | null): boolean {
  if (!session) return false;
  return platformAdminEmails().has(session.user.email.toLowerCase());
}

/**
 * Gate for the one admin-only mutation in the app today (Worker/Monitoring
 * settings — global, shared by every organization on the deployment, see
 * `@sla/db`'s `WorkerSettings` doc comment). Only a platform operator
 * (`PLATFORM_ADMIN_EMAILS`) may write it; every tenant, including an org
 * owner, gets a read-only view. Every other settings mutation (SLA config,
 * notifications, integrations) is intentionally left open to any signed-in
 * organization member, unchanged.
 */
export function requirePlatformOperator(session: Session | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isPlatformOperator(session)) {
    return NextResponse.json({ error: "Only a platform operator can change this setting" }, { status: 403 });
  }
  return null;
}
