import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient, listMembers } from "@sla/db";
import { authOptions } from "@/lib/auth";

/**
 * Any signed-in organization member can list members — reads stay open to
 * everyone (task 5.4's authorization audit only gates mutations; members
 * need to see this to work cases). Changing a role or removing a member is
 * owner-only, see `[id]/route.ts`.
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
