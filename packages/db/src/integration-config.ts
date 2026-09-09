import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client";

/**
 * Integrations whose OAuth app credentials are configured per-organization
 * from the Integrations settings UI (roadmap: integration config refactor)
 * rather than a single global `.env` value. Deliberately excludes `linear`
 * (disabled in the UI, still env-only) — kept a separate, narrower union
 * from `IntegrationProvider` so extending it doesn't touch that enum.
 */
export type ConfigurableIntegrationProvider = "zendesk" | "jira" | "slack";

const CONFIGURABLE_PROVIDERS: ConfigurableIntegrationProvider[] = [
  "zendesk",
  "jira",
  "slack",
];

export function isConfigurableIntegrationProvider(
  value: string,
): value is ConfigurableIntegrationProvider {
  return (CONFIGURABLE_PROVIDERS as string[]).includes(value);
}

export interface IntegrationOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export interface IntegrationConfigStatus {
  configured: boolean;
  clientId: string | null;
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_SALT = "sla-breach-monitoring/integration-config";

/**
 * Derives a stable AES-256 key from INTEGRATION_CONFIG_ENCRYPTION_KEY rather than requiring a
 * dedicated encryption-key env var — the app already treats INTEGRATION_CONFIG_ENCRYPTION_KEY
 * as its one required app-wide secret, and there is no other secrets-storage
 * mechanism in this codebase to reuse (access tokens are stored as plain
 * JSON on `Integration.credentials`).
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "INTEGRATION_CONFIG_ENCRYPTION_KEY must be set to encrypt or decrypt integration configuration",
    );
  }
  return scryptSync(secret, ENCRYPTION_SALT, 32);
}

/** AES-256-GCM encrypt. Output is base64url(iv) + "." + base64url(authTag) + "." + base64url(ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((buf) => buf.toString("base64url"))
    .join(".");
}

export function decryptSecret(encoded: string): string {
  const [ivPart, authTagPart, ciphertextPart] = encoded.split(".");
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error("Malformed encrypted integration secret");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function envVarPrefix(provider: ConfigurableIntegrationProvider): string {
  return provider.toUpperCase();
}

/**
 * Legacy fallback for installs that connected an integration before this
 * table existed — those still have their OAuth app's client id/secret in
 * `.env` and nothing in `integration_configs`. Reading them here (rather
 * than migrating data) keeps a connected integration working exactly as
 * before until the org re-saves its configuration from the settings UI.
 */
function readEnvFallback(
  provider: ConfigurableIntegrationProvider,
): IntegrationOAuthCredentials | null {
  const prefix = envVarPrefix(provider);
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Resolves the OAuth app credentials for one organization's integration:
 * the org's own configuration (saved via the settings UI) if it exists,
 * otherwise the legacy global env vars, otherwise null (not configured).
 */
export async function getIntegrationConfig(
  prisma: PrismaClient,
  organizationId: string,
  provider: ConfigurableIntegrationProvider,
): Promise<IntegrationOAuthCredentials | null> {
  const row = await prisma.integrationConfig.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });

  if (row) {
    return {
      clientId: row.clientId,
      clientSecret: decryptSecret(row.clientSecret),
    };
  }

  return readEnvFallback(provider);
}

/** Status-only read for the settings UI — never exposes the secret itself. */
export async function getIntegrationConfigStatus(
  prisma: PrismaClient,
  organizationId: string,
  provider: ConfigurableIntegrationProvider,
): Promise<IntegrationConfigStatus> {
  const row = await prisma.integrationConfig.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
    select: { clientId: true },
  });
  if (row) return { configured: true, clientId: row.clientId };

  const fallback = readEnvFallback(provider);
  return fallback
    ? { configured: true, clientId: fallback.clientId }
    : { configured: false, clientId: null };
}

/**
 * Saves one organization's OAuth app configuration. `clientSecret` is
 * optional on an update so the settings form can let an admin change the
 * client id without having to re-paste a secret it never echoes back.
 */
export async function saveIntegrationConfig(
  prisma: PrismaClient,
  organizationId: string,
  provider: ConfigurableIntegrationProvider,
  input: { clientId: string; clientSecret?: string },
): Promise<void> {
  const existing = await prisma.integrationConfig.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
    select: { id: true },
  });

  if (!existing && !input.clientSecret) {
    throw new Error("clientSecret is required to configure this integration");
  }

  await prisma.integrationConfig.upsert({
    where: { organizationId_provider: { organizationId, provider } },
    create: {
      organizationId,
      provider,
      clientId: input.clientId,
      clientSecret: encryptSecret(input.clientSecret as string),
    },
    update: {
      clientId: input.clientId,
      ...(input.clientSecret
        ? { clientSecret: encryptSecret(input.clientSecret) }
        : {}),
    },
  });
}
