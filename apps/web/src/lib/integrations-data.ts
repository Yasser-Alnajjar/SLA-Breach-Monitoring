import type { PrismaClient } from "@sla/db";
import type { ZendeskCredentials, ZendeskCursor } from "@sla/zendesk";
import type { JiraCredentials, JiraCursor } from "@sla/jira";
import type { LinearCredentials, LinearCursor } from "@sla/linear";
import { getSlaPolicies } from "./sla-policies-data";
import type { IntegrationsPageData } from "./types/integrations";

/** Assembles the integrations settings page's read model (roadmap step 17). */
export async function getIntegrationsData(prisma: PrismaClient, organizationId: string): Promise<IntegrationsPageData> {
  const [zendeskIntegration, jiraIntegration, linearIntegration, slackIntegration, organization, slaPolicies] = await Promise.all([
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "zendesk" } },
    }),
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "jira" } },
    }),
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "linear" } },
    }),
    prisma.slackIntegration.findUnique({
      where: { organizationId },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { engineeringLegTargetMinutes: true },
    }),
    getSlaPolicies(prisma, organizationId),
  ]);

  return {
    zendeskIntegration,
    zendeskCursor: (zendeskIntegration?.cursor as ZendeskCursor | null) ?? null,
    zendeskCredentials: (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null,
    jiraIntegration,
    jiraCursor: (jiraIntegration?.cursor as JiraCursor | null) ?? null,
    jiraCredentials: (jiraIntegration?.credentials as JiraCredentials | null) ?? null,
    linearIntegration,
    linearCursor: (linearIntegration?.cursor as LinearCursor | null) ?? null,
    linearCredentials: (linearIntegration?.credentials as LinearCredentials | null) ?? null,
    slackIntegration,
    engineeringLegTargetMinutes: organization?.engineeringLegTargetMinutes ?? null,
    slaPolicies,
  };
}
