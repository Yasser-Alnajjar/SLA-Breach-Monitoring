import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient, listPendingInvitations } from "@sla/db";
import { authOptions } from "@/lib/auth";
import type { PendingInvitation } from "@/lib/types/invitations";

export const InvitationsActions = {
  async getData(): Promise<PendingInvitation[]> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    const invitations = await listPendingInvitations(prisma, session.user.organizationId);
    return invitations.map((i) => ({
      id: i.id,
      email: i.email,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  },
};
