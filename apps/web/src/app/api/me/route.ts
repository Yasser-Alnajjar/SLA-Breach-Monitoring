import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/profile";
import type { IUser } from "@/lib/types/user";

const USER_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  image: true,
  role: true,
  createdAt: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: USER_SELECT,
  });
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json(user satisfies IUser);
}

/** Profile page: name and avatar URL — the only fields a user can self-edit. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, image: parsed.data.image },
    select: USER_SELECT,
  });

  return NextResponse.json(user satisfies IUser);
}
