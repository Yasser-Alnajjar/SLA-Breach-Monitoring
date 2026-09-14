import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { signUpSchema } from "@/lib/sign-up";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { organizationName, email, password } = parsed.data;
  const prisma = getPrismaClient();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.organization.create({
    data: {
      name: organizationName,
      // Sign-up is still the only path that creates a `User` row (no invite
      // flow yet), so whoever creates the organization is its owner — the
      // only role that can change Worker/Monitoring settings.
      users: { create: { email, passwordHash, role: "owner" } },
    },
  });

  return NextResponse.json({ ok: true });
}
