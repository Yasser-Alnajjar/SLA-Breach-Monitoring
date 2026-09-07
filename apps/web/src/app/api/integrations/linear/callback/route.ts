import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@sla/linear";
import { getPrismaClient, type Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getLinearOAuthConfig, LINEAR_STATE_COOKIE } from "@/lib/linear-env";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${LINEAR_STATE_COOKIE}=`))
    ?.slice(LINEAR_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const state = JSON.parse(Buffer.from(cookieState, "base64url").toString("utf-8")) as {
    organizationId: string;
  };

  if (state.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }

  const config = getLinearOAuthConfig();
  const credentials = await exchangeCodeForToken(code, config);

  const prisma = getPrismaClient();
  await prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: state.organizationId, provider: "linear" } },
    create: {
      organizationId: state.organizationId,
      provider: "linear",
      credentials: credentials as unknown as Prisma.InputJsonValue,
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
  response.cookies.delete(LINEAR_STATE_COOKIE);
  return response;
}
