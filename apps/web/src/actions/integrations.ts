import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getIntegrationsData } from "@/lib/integrations-data";
import type { IntegrationsPageData } from "@/lib/types/integrations";

export const IntegrationsActions = {
  async getData(): Promise<IntegrationsPageData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getIntegrationsData(prisma, session.user.organizationId);
  },
};
