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
 * rather than a single global `.env` value. Kept a separate, narrower union
 * from `IntegrationProvider` so extending it doesn't touch that enum.
 */
export type ConfigurableIntegrationProvider =
  | "zendesk"
  | "jira"
  | "slack"
  | "linear"
  | "intercom"
  | "github";

const CONFIGURABLE_PROVIDERS: ConfigurableIntegrationProvider[] = [
  "zendesk",
  "jira",
  "linear",
  "slack",
  "intercom",
  "github",
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

/**
 * Thrown by `getIntegrationConfig` when a row exists but its `clientSecret`
 * can't be decrypted (wrong/rotated `INTEGRATION_CONFIG_ENCRYPTION_KEY`, or
 * corrupted ciphertext) — distinct from "not configured" (no row), which is
 * a normal state and returns `null` instead of throwing. The message is
 * deliberately generic and stable: several callers surface `error.message`
 * directly in a 5xx response, so it must never carry ciphertext, the
 * underlying crypto error, or a stack trace. `cause` keeps the real error
 * available for server-side logging only.
 */
export class IntegrationConfigUnreadableError extends Error {
  constructor(cause: unknown) {
    super(
      "Integration configuration is unavailable. Please re-enter the configuration.",
    );
    this.name = "IntegrationConfigUnreadableError";
    this.cause = cause;
  }
}

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_SALT = "sla-breach-monitoring/integration-config";

/**
 * Derives a stable AES-256 key from the dedicated INTEGRATION_CONFIG_ENCRYPTION_KEY secret —
 * kept separate from NEXTAUTH_SECRET so rotating one never invalidates the other.
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

/**
 * Resolves the OAuth app credentials for one organization's integration from
 * its own configuration (saved via the settings UI), or null when the
 * organization hasn't configured this integration yet.
 */
export async function getIntegrationConfig(
  prisma: PrismaClient,
  organizationId: string,
  provider: ConfigurableIntegrationProvider,
): Promise<IntegrationOAuthCredentials | null> {
  const row = await prisma.integrationConfig.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });

  if (!row) return null;

  try {
    return {
      clientId: row.clientId,
      clientSecret: decryptSecret(row.clientSecret),
    };
  } catch (error) {
    throw new IntegrationConfigUnreadableError(error);
  }
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
  return row
    ? { configured: true, clientId: row.clientId }
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
