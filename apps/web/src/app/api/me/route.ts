import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import type { IUser } from "@/lib/types/user";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      organizationId: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json(user satisfies IUser);
}
