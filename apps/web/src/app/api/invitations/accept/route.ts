import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPrismaClient,
  previewInvitation,
  acceptInvitation,
  EmailAlreadyRegisteredError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationNotPendingError,
} from "@sla/db";

/**
 * Public — no session (see `apps/web/src/proxy.ts`'s `PUBLIC_API_PATHS`).
 * The token itself is the only credential; nothing here trusts a session
 * cookie either way. GET previews (never consumes) the token for the
 * accept page; POST is the one-shot, single-use acceptance.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const prisma = getPrismaClient();
  try {
    const preview = await previewInvitation(prisma, token);
    if (!preview) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({ error: previewErrorMessage(error) }, { status: 410 });
  }
}

function previewErrorMessage(error: unknown): string {
  if (error instanceof InvitationExpiredError) return error.message;
  if (error instanceof InvitationNotPendingError) return error.message;
  throw error;
}

const acceptSchema = z.object({
  token: z.string().min(1, "Missing token"),
  name: z.string().trim().min(1, "Name is required").max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const prisma = getPrismaClient();

  try {
    const result = await acceptInvitation(prisma, {
      token: parsed.data.token,
      name: parsed.data.name,
      passwordHash,
    });
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvitationExpiredError || error instanceof InvitationNotPendingError) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }
    if (error instanceof EmailAlreadyRegisteredError) {
      return NextResponse.json({ error: "This email already has an account. Sign in instead." }, { status: 409 });
    }
    throw error;
  }
}
