import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@sla/slack";
import { authOptions } from "@/lib/auth";
import { requireOwner } from "@/lib/authz";
import { getSlackOAuthConfig, SLACK_STATE_COOKIE } from "@/lib/slack-env";
import { signOAuthState } from "@/lib/oauth-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = requireOwner(session);
  if (denied) return denied;

  let config;
  try {
    config = await getSlackOAuthConfig(session.user.organizationId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Slack OAuth is not configured" },
      { status: 500 },
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = signOAuthState({ nonce, organizationId: session.user.organizationId, userId: session.user.id });

  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  response.cookies.set(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
