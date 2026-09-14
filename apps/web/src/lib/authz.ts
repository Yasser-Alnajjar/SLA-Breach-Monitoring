import type { Session } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Gate for the one admin-only mutation in the app today (Worker/Monitoring
 * settings — global, shared by every organization on the deployment, see
 * `@sla/db`'s `WorkerSettings` doc comment). Every other settings mutation
 * (SLA config, notifications, integrations) is intentionally left open to
 * any signed-in organization member, unchanged.
 */
export function requireOwner(session: Session | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (session.user.role !== "owner") {
    return NextResponse.json({ error: "Only an organization owner can change this setting" }, { status: 403 });
  }
  return null;
}
