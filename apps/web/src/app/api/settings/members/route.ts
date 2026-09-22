import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient, listMembers } from "@sla/db";
import { authOptions } from "@/lib/auth";

/**
 * Any signed-in organization member can list members, same as every other
 * settings mutation today (see `authz.ts`'s doc comment) — role restriction
 * is 5.4's authorization audit, not this task's.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prisma = getPrismaClient();
  const members = await listMembers(prisma, session.user.organizationId);
  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
