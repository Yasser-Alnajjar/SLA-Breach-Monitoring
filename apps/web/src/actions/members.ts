import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient, listMembers } from "@sla/db";
import { authOptions } from "@/lib/auth";
import type { OrganizationMemberSummary } from "@/lib/types/members";

export const MembersActions = {
  async getData(): Promise<{ members: OrganizationMemberSummary[]; currentUserId: string }> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    const members = await listMembers(prisma, session.user.organizationId);
    return {
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
      currentUserId: session.user.id,
    };
  },
};
