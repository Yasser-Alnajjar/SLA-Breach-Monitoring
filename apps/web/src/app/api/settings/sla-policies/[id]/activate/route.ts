import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { NotANativePolicyError, PolicyNotFoundError, setPolicyActive } from "@sla/commitments";
import { authOptions } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const prisma = getPrismaClient();
  try {
    await setPolicyActive(prisma, session.user.organizationId, id, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PolicyNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NotANativePolicyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
