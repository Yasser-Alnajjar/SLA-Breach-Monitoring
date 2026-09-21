import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { encryptCredentials, encryptToken, isEncryptedToken } from "../integration-credentials";

/**
 * One-off, idempotent backfill for existing rows saved before token
 * encryption-at-rest shipped (roadmap task 2.1). Every write path
 * (`callback/route.ts` for each provider, every `tokenLifecycle.ts`) already
 * encrypts going forward — this only reaches rows that predate that change.
 * Safe to run repeatedly: a row whose tokens are already marked (`enc:v1:`,
 * see `isEncryptedToken`) is left untouched, so a second run makes zero
 * writes. Run via `pnpm db:encrypt-tokens`.
 */

interface CredentialsWithTokens {
  accessToken?: unknown;
  refreshToken?: unknown;
  [key: string]: unknown;
}

function isUnencryptedCredentials(value: unknown): value is CredentialsWithTokens & { accessToken: string } {
  if (!value || typeof value !== "object") return false;
  const credentials = value as CredentialsWithTokens;
  if (typeof credentials.accessToken !== "string") return false;
  const accessTokenNeedsEncryption = !isEncryptedToken(credentials.accessToken);
  const refreshTokenNeedsEncryption =
    typeof credentials.refreshToken === "string" && !isEncryptedToken(credentials.refreshToken);
  return accessTokenNeedsEncryption || refreshTokenNeedsEncryption;
}

export interface EncryptIntegrationTokensResult {
  integrationsEncrypted: number;
  slackIntegrationsEncrypted: number;
}

export async function encryptIntegrationTokens(prisma: PrismaClient): Promise<EncryptIntegrationTokensResult> {
  const result: EncryptIntegrationTokensResult = { integrationsEncrypted: 0, slackIntegrationsEncrypted: 0 };

  const integrations = await prisma.integration.findMany({ select: { id: true, credentials: true } });
  for (const integration of integrations) {
    if (!isUnencryptedCredentials(integration.credentials)) continue;
    const encrypted = encryptCredentials(integration.credentials as { accessToken: string; refreshToken?: string });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { credentials: encrypted as unknown as Prisma.InputJsonValue },
    });
    result.integrationsEncrypted += 1;
  }

  const slackIntegrations = await prisma.slackIntegration.findMany({ select: { id: true, accessToken: true } });
  for (const slack of slackIntegrations) {
    if (isEncryptedToken(slack.accessToken)) continue;
    await prisma.slackIntegration.update({
      where: { id: slack.id },
      data: { accessToken: encryptToken(slack.accessToken) },
    });
    result.slackIntegrationsEncrypted += 1;
  }

  return result;
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { getPrismaClient } = await import("../index");
  encryptIntegrationTokens(getPrismaClient())
    .then((result) => {
      console.log(
        `Encrypted ${result.integrationsEncrypted} Integration row(s) and ${result.slackIntegrationsEncrypted} SlackIntegration row(s).`,
      );
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("encrypt-integration-tokens failed:", error);
      process.exit(1);
    });
}
