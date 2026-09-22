import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPrismaClient,
  resetPassword,
  PasswordResetTokenExpiredError,
  PasswordResetTokenNotFoundError,
  PasswordResetTokenUsedError,
} from "@sla/db";

/**
 * Public (see `apps/web/src/proxy.ts`'s `PUBLIC_API_PATHS`) — the one-shot
 * consumption of a "forgot password" token. The token itself is the only
 * credential; no session is required or checked either way.
 */
const confirmSchema = z.object({
  token: z.string().min(1, "Missing token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const prisma = getPrismaClient();

  try {
    await resetPassword(prisma, { token: parsed.data.token, passwordHash });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PasswordResetTokenNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PasswordResetTokenExpiredError || error instanceof PasswordResetTokenUsedError) {
      return NextResponse.json({ error: error.message }, { status: 410 });
    }
    throw error;
  }
}
