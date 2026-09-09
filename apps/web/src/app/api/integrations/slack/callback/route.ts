import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@sla/slack";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getSlackOAuthConfig, SLACK_STATE_COOKIE } from "@/lib/slack-env";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${SLACK_STATE_COOKIE}=`))
    ?.slice(SLACK_STATE_COOKIE.length + 1);

  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const state = JSON.parse(Buffer.from(cookieState, "base64url").toString("utf-8")) as {
    organizationId: string;
  };

  if (state.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }

  const config = await getSlackOAuthConfig(state.organizationId);
  const credentials = await exchangeCodeForToken(code, config);

  const prisma = getPrismaClient();
  await prisma.slackIntegration.upsert({
    where: { organizationId: state.organizationId },
    create: {
      organizationId: state.organizationId,
      accessToken: credentials.accessToken,
      teamId: credentials.teamId,
      teamName: credentials.teamName,
      botUserId: credentials.botUserId,
    },
    // Re-installing keeps the previously chosen channel — Slack's install
    // flow doesn't re-ask for it, so there's nothing new to overwrite there.
    update: {
      accessToken: credentials.accessToken,
      teamId: credentials.teamId,
      teamName: credentials.teamName,
      botUserId: credentials.botUserId,
    },
  });

  const response = NextResponse.redirect(new URL("/settings/integrations?connected=slack", request.url));
  response.cookies.delete(SLACK_STATE_COOKIE);
  return response;
}
