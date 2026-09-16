import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { listAuthorizedOrganizations, listSourceIntegrations } from "@/lib/concierge-access";
import type { ConciergeExportPageData, ConciergeSourceProvider } from "@/lib/types/concierge-export";

export const ConciergeActions = {
  async getExportData(provider: ConciergeSourceProvider): Promise<ConciergeExportPageData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    const organizations = await listAuthorizedOrganizations(prisma, session);
    // With a single organization it's preselected, so its integrations ship with the page.
    const initialOrganizationId = organizations.length === 1 ? organizations[0]!.id : null;
    const initialIntegrations = initialOrganizationId
      ? await listSourceIntegrations(prisma, initialOrganizationId, provider)
      : [];

    return { provider, organizations, initialOrganizationId, initialIntegrations };
  },
};
