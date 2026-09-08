import "server-only";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getIntegrationDetailData } from "@/lib/integration-detail-data";
import { getIntegrationsData } from "@/lib/integrations-data";
import { isIntegrationProvider, type IntegrationDetailData, type IntegrationsPageData } from "@/lib/types/integrations";

export const IntegrationsActions = {
  async getData(): Promise<IntegrationsPageData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getIntegrationsData(prisma, session.user.organizationId);
  },

  async getDetail(provider: string): Promise<IntegrationDetailData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");
    if (!isIntegrationProvider(provider)) notFound();

    const prisma = getPrismaClient();
    const data = await getIntegrationDetailData(prisma, session.user.organizationId, provider);
    if (!data) notFound();
    return data;
  },
};
