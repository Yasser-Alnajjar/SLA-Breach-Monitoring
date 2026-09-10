import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken, generateWebhookSecret } from "@sla/zendesk";
import { getPrismaClient, type Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getZendeskOAuthConfig, ZENDESK_STATE_COOKIE } from "@/lib/zendesk-env";
import { validateOAuthState } from "@/lib/oauth-state";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${ZENDESK_STATE_COOKIE}=`))
    ?.slice(ZENDESK_STATE_COOKIE.length + 1);

  if (!code) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const validation = validateOAuthState({
    returnedState: url.searchParams.get("state"),
    cookieState,
    sessionOrganizationId: session.user.organizationId,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const state = validation.state as { subdomain: string; organizationId: string };

  const config = await getZendeskOAuthConfig(state.organizationId);
  const credentials = await exchangeCodeForToken(state.subdomain, code, config);

  const prisma = getPrismaClient();
  await prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: state.organizationId, provider: "zendesk" } },
    create: {
      organizationId: state.organizationId,
      provider: "zendesk",
      credentials: credentials as unknown as Prisma.InputJsonValue,
      // Generated once, here, and never rotated on reconnect — see
      // Integration.webhookSecret's doc comment (roadmap step 20).
      webhookSecret: generateWebhookSecret(),
    },
    // Reconnecting always clears any prior disconnected/reauth_required state
    // and stale sync error, whether this is a first connect or a reconnect.
    update: {
      credentials: credentials as unknown as Prisma.InputJsonValue,
      status: "connected",
      disconnectedAt: null,
      lastSyncError: null,
    },
  });

  const response = NextResponse.redirect(new URL("/onboarding", request.url));
  response.cookies.delete(ZENDESK_STATE_COOKIE);
  return response;
}
