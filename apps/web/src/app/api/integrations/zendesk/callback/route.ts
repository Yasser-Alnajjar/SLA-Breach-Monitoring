import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken, generateWebhookSecret } from "@sla/zendesk";
import { getPrismaClient, type Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getZendeskOAuthConfig, ZENDESK_STATE_COOKIE } from "@/lib/zendesk-env";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${ZENDESK_STATE_COOKIE}=`))
    ?.slice(ZENDESK_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const state = JSON.parse(Buffer.from(cookieState, "base64url").toString("utf-8")) as {
    subdomain: string;
    organizationId: string;
  };

  if (state.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }

  const config = getZendeskOAuthConfig();
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
