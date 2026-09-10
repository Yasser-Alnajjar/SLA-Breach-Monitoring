import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@sla/slack";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getSlackOAuthConfig, SLACK_STATE_COOKIE } from "@/lib/slack-env";
import { validateOAuthState } from "@/lib/oauth-state";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${SLACK_STATE_COOKIE}=`))
    ?.slice(SLACK_STATE_COOKIE.length + 1);

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
  const { state } = validation;

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
