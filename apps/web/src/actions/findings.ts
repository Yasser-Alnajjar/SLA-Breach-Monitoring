import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getFindingsData } from "@/lib/findings-data";
import type { FindingsData } from "@/lib/types/findings";

export const FindingsActions = {
  async getData(): Promise<FindingsData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getFindingsData(prisma, session.user.organizationId);
  },
};
