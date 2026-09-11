import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@sla/intercom";
import { authOptions } from "@/lib/auth";
import { getIntercomOAuthConfig, INTERCOM_STATE_COOKIE } from "@/lib/intercom-env";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let config;
  try {
    config = await getIntercomOAuthConfig(session.user.organizationId);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Intercom OAuth is not configured",
      },
      { status: 500 },
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ nonce, organizationId: session.user.organizationId }),
  ).toString("base64url");

  const response = NextResponse.redirect(buildAuthorizeUrl(config, state));
  response.cookies.set(INTERCOM_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
