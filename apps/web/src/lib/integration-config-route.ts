import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import {
  getIntegrationConfigStatus,
  saveIntegrationConfig,
  type ConfigurableIntegrationProvider,
  getPrismaClient,
} from "@sla/db";
import { authOptions } from "@/lib/auth";
import { requireOwner } from "@/lib/authz";

/**
 * Shared GET/POST handlers for `/api/integrations/{provider}/config`,
 * reused by the zendesk/jira/slack route files — the three configurable
 * integrations all save the same shape (client id + secret), so this is the
 * one place that logic lives rather than being copy-pasted three times.
 */
export function createIntegrationConfigHandlers(
  provider: ConfigurableIntegrationProvider,
) {
  async function GET() {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const status = await getIntegrationConfigStatus(
      getPrismaClient(),
      session.user.organizationId,
      provider,
    );

    return NextResponse.json(status);
  }

  async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const denied = requireOwner(session);
    if (denied) return denied;

    const body = (await request.json().catch(() => null)) as {
      clientId?: unknown;
      clientSecret?: unknown;
    } | null;

    const clientId =
      typeof body?.clientId === "string" ? body.clientId.trim() : "";
    const clientSecret =
      typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID is required" },
        { status: 400 },
      );
    }

    // Sessions are JWTs, never checked against the database, so one can
    // outlive its organization (e.g. a dev database reset). Without this the
    // create below fails on the foreign key with a raw Prisma error.
    const organization = await getPrismaClient().organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true },
    });
    if (!organization) {
      return NextResponse.json(
        {
          error:
            "Your session refers to an organization that no longer exists. Sign out and sign in again.",
        },
        { status: 401 },
      );
    }

    try {
      await saveIntegrationConfig(
        getPrismaClient(),
        session.user.organizationId,
        provider,
        {
          clientId,
          // Empty string means "leave the existing secret unchanged" on an update.
          clientSecret: clientSecret || undefined,
        },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to save configuration",
        },
        { status: 400 },
      );
    }

    const status = await getIntegrationConfigStatus(
      getPrismaClient(),
      session.user.organizationId,
      provider,
    );

    return NextResponse.json(status);
  }

  return { GET, POST };
}
