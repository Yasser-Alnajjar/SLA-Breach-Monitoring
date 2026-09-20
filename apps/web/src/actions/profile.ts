import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import type { IUser } from "@/lib/types/user";

export const ProfileActions = {
  async getData(): Promise<IUser> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

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
    if (!user) redirect("/sign-in");

    return user;
  },
};
