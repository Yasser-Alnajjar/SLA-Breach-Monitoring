import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { targetMinutes?: number } | null;
  const targetMinutes = body?.targetMinutes;
  if (typeof targetMinutes !== "number" || !Number.isInteger(targetMinutes) || targetMinutes <= 0) {
    return NextResponse.json({ error: "targetMinutes must be a positive integer" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { engineeringLegTargetMinutes: targetMinutes },
  });

  return NextResponse.json({ targetMinutes });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { engineeringLegTargetMinutes: null },
  });

  return NextResponse.json({ targetMinutes: null });
}
