import type { PrismaClient } from "@sla/db";
import { getIntegrationConfigStatus } from "@sla/db";
import type { ZendeskCredentials } from "@sla/zendesk";
import type {
  IntegrationConnectionView,
  IntegrationsPageData,
} from "./types/integrations";

type IntegrationRow = {
  connectedAt: Date;
  disconnectedAt: Date | null;
  credentials: unknown;
} | null;

/** Never return `credentials`/the row itself — only these display-only scalars. */
function toConnectionView(
  integration: IntegrationRow,
): IntegrationConnectionView {
  if (!integration) {
    return {
      connected: false,
      reauthRequired: false,
      connectedAt: null,
      disconnectedAt: null,
    };
  }
  const credentials = integration.credentials as {
    reauthRequired?: boolean;
  } | null;
  return {
    connected: credentials !== null,
    reauthRequired: credentials?.reauthRequired === true,
    connectedAt: integration.connectedAt,
    disconnectedAt: integration.disconnectedAt,
  };
}

/** Assembles the integrations settings page's read model (roadmap step 17). */
export async function getIntegrationsData(
  prisma: PrismaClient,
  organizationId: string,
): Promise<IntegrationsPageData> {
  const [
    zendeskIntegration,
    jiraIntegration,
    linearIntegration,
    intercomIntegration,
    githubIntegration,
    slackIntegration,
    zendeskConfig,
    linearConfig,
    jiraConfig,
    slackConfig,
    intercomConfig,
    githubConfig,
  ] = await Promise.all([
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "zendesk" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "jira" } },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "linear" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "intercom" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: "github" },
      },
      select: { connectedAt: true, disconnectedAt: true, credentials: true },
    }),
    prisma.slackIntegration.findUnique({
      where: { organizationId },
      select: {
        teamName: true,
        channelId: true,
        channelName: true,
        installedAt: true,
      },
    }),
    getIntegrationConfigStatus(prisma, organizationId, "zendesk"),
    getIntegrationConfigStatus(prisma, organizationId, "linear"),
    getIntegrationConfigStatus(prisma, organizationId, "jira"),
    getIntegrationConfigStatus(prisma, organizationId, "slack"),
    getIntegrationConfigStatus(prisma, organizationId, "intercom"),
    getIntegrationConfigStatus(prisma, organizationId, "github"),
  ]);

  const zendeskCredentials =
    (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;

  return {
    zendesk: {
      ...toConnectionView(zendeskIntegration),
      subdomain: zendeskCredentials?.subdomain ?? null,
    },
    jira: toConnectionView(jiraIntegration),
    linear: toConnectionView(linearIntegration),
    intercom: toConnectionView(intercomIntegration),
    github: toConnectionView(githubIntegration),
    slack: {
      connected: slackIntegration !== null,
      teamName: slackIntegration?.teamName ?? null,
      channelId: slackIntegration?.channelId ?? null,
      channelName: slackIntegration?.channelName ?? null,
      installedAt: slackIntegration?.installedAt ?? null,
    },
    jiraConfig,
    zendeskConfig,
    linearConfig,
    slackConfig,
    intercomConfig,
    githubConfig,
  };
}
