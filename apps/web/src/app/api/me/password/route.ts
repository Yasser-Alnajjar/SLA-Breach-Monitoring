import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import {
  checkAuthThrottle,
  clearAuthThrottle,
  recordFailedAuthAttempt,
} from "@/lib/auth-throttle";
import { changePasswordSchema } from "@/lib/profile";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Same progressive-cooldown throttle sign-in uses (`@/lib/auth-throttle`),
  // keyed per-user here since the caller is already authenticated — this
  // only slows down someone who has hijacked a live session and is guessing
  // at the current password to lock the real owner out.
  const throttleKey = `change-password:${session.user.id}`;
  const throttle = checkAuthThrottle(throttleKey);
  if (throttle.throttled) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${throttle.retryAfterSeconds}s.`,
      },
      { status: 429 },
    );
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const valid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!valid) {
    recordFailedAuthAttempt(throttleKey);
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }

  clearAuthThrottle(throttleKey);

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
