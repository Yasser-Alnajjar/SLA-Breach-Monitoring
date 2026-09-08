import type { PrismaClient } from "@sla/db";
import type { IntegrationDetailData, IntegrationProvider } from "./types/integrations";

/**
 * Assembles `/settings/integrations/[provider]`'s read model. Returns null
 * for a provider that was never connected, or whose credentials were
 * cleared by a disconnect — either way there's nothing to manage, and the
 * caller (`Actions.Integrations.getDetail`) turns that into a 404 rather
 * than rendering an empty page.
 */
export async function getIntegrationDetailData(
  prisma: PrismaClient,
  organizationId: string,
  provider: IntegrationProvider,
): Promise<IntegrationDetailData | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
  if (!integration || !integration.credentials) return null;

  return {
    provider,
    integration,
    credentials: integration.credentials as unknown as IntegrationDetailData["credentials"],
    cursor: (integration.cursor as unknown as IntegrationDetailData["cursor"]) ?? null,
  };
}
