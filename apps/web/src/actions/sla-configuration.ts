import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getSlaConfigurationData } from "@/lib/sla-configuration-data";
import type { SlaConfigurationData } from "@/lib/types/sla-configuration";

export const SlaConfigurationActions = {
  async getData(): Promise<SlaConfigurationData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getSlaConfigurationData(prisma, session.user.organizationId);
  },
};
