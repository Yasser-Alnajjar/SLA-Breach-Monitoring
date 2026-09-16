import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { exchangeCodeForToken, GithubClient, GithubPermissionDeniedError } from "@sla/github";
import { getPrismaClient, type Prisma } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getGithubOAuthConfig, GITHUB_STATE_COOKIE } from "@/lib/github-env";
import { validateOAuthState } from "@/lib/oauth-state";
import { getAppUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/sign-in", getAppUrl()));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((entry) => entry.startsWith(`${GITHUB_STATE_COOKIE}=`))
    ?.slice(GITHUB_STATE_COOKIE.length + 1);

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
  const state = validation.state as { repo: string; organizationId: string };
  const [owner, repo] = state.repo.split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const config = await getGithubOAuthConfig(state.organizationId);
  const tokenCredentials = await exchangeCodeForToken(code, config);
  const credentials = { ...tokenCredentials, owner, repo };

  // A GitHub App only sees repositories it is installed on. Check before
  // saving, so a typo or a missing installation fails here instead of
  // syncing nothing without any error.
  try {
    await new GithubClient(credentials).verifyRepositoryAccess(owner, repo);
  } catch (error) {
    if (error instanceof GithubPermissionDeniedError) {
      return NextResponse.json(
        {
          error: `GitHub can't read ${owner}/${repo}. Check the repository name, and that your GitHub App is installed on that repository.`,
        },
        { status: 400 },
      );
    }
    throw error;
  }

  const prisma = getPrismaClient();
  await prisma.integration.upsert({
    where: { organizationId_provider: { organizationId: state.organizationId, provider: "github" } },
    create: {
      organizationId: state.organizationId,
      provider: "github",
      credentials: credentials as unknown as Prisma.InputJsonValue,
    },
    // Reconnecting always clears any prior disconnected/reauth_required state
    // and stale sync error, whether this is a first connect or a reconnect.
    // Also picks up a newly-entered repo, if the user reconnected with one.
    update: {
      credentials: credentials as unknown as Prisma.InputJsonValue,
      status: "connected",
      disconnectedAt: null,
      lastSyncError: null,
    },
  });

  // GitHub is a settings-only connect flow (mirrors Linear/Intercom), not
  // part of onboarding — lands back on the settings page, not /onboarding.
  const response = NextResponse.redirect(new URL("/settings/integrations", getAppUrl()));
  response.cookies.delete(GITHUB_STATE_COOKIE);
  return response;
}
