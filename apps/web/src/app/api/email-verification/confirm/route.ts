import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPrismaClient,
  verifyEmail,
  EmailAlreadyRegisteredError,
  EmailVerificationTokenExpiredError,
  EmailVerificationTokenNotFoundError,
  EmailVerificationTokenUsedError,
} from "@sla/db";

/**
 * Public (see `apps/web/src/proxy.ts`'s `PUBLIC_API_PATHS`) — consumes a
 * signup-verification or change-email token (roadmap 5.6). The token
 * itself is the only credential; no session is required or checked either
 * way, since the link is opened from an email client that may not share a
 * browser with any signed-in session.
 */
const confirmSchema = z.object({
  token: z.string().min(1, "Missing token"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  try {
    const result = await verifyEmail(prisma, parsed.data.token);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    if (error instanceof EmailVerificationTokenNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof EmailVerificationTokenExpiredError || error instanceof EmailVerificationTokenUsedError) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json(
        { error: "That email was registered by another account before this link was confirmed." },
        { status: 409 },
      );
    }
    throw error;
  }
}
