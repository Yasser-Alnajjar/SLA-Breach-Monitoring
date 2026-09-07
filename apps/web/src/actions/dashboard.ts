import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import type { DashboardData } from "@/lib/types/dashboard";

export const DashboardActions = {
  async getData(): Promise<DashboardData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getDashboardData(prisma, session.user.organizationId);
  },
};
