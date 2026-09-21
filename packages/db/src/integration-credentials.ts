import { aesGcmDecrypt, aesGcmEncrypt, deriveEncryptionKey } from "./crypto";

const ENCRYPTION_SALT = "sla-breach-monitoring/integration-credentials";

/**
 * Self-describing marker: lets every decrypt call site (and the migration
 * script) tell an already-encrypted value apart from a plaintext one without
 * a side channel. Distinct from `IntegrationConfig`'s encrypted secrets
 * (which have no marker) because those are always-encrypted from a single
 * write path, while these tokens are migrated in place on rows that may
 * still be plaintext until the migration script reaches them.
 */
const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Thrown when a stored token can't be decrypted (wrong/rotated
 * `INTEGRATION_TOKEN_ENCRYPTION_KEY`, or corrupted ciphertext) — mirrors
 * `IntegrationConfigUnreadableError`'s shape: a generic, stable message safe
 * to surface in a response, with the real error kept on `cause` for
 * server-side logging only.
 */
export class IntegrationCredentialsUnreadableError extends Error {
  constructor(cause: unknown) {
    super(
      "Integration credentials are unavailable. Please reconnect the integration.",
    );
    this.name = "IntegrationCredentialsUnreadableError";
    this.cause = cause;
  }
}

function getEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "INTEGRATION_TOKEN_ENCRYPTION_KEY must be set to encrypt or decrypt integration tokens",
    );
  }
  return deriveEncryptionKey(secret, ENCRYPTION_SALT);
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptToken(plaintext: string): string {
  return ENCRYPTED_PREFIX + aesGcmEncrypt(getEncryptionKey(), plaintext);
}

/** Tolerates a not-yet-migrated plaintext value (no marker) — returns it unchanged rather than throwing, so a row the migration script hasn't reached yet still works. */
export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) return value;
  try {
    return aesGcmDecrypt(
      getEncryptionKey(),
      value.slice(ENCRYPTED_PREFIX.length),
    );
  } catch (error) {
    throw new IntegrationCredentialsUnreadableError(error);
  }
}

/** Every provider's credentials JSON shape carries at least these two token fields; the rest (subdomain, expiresAt, scope, reauthRequired, …) pass through untouched — see the module doc comment on why only these two are encrypted. */
interface TokenFields {
  accessToken: string;
  refreshToken?: string;
}

/** Encrypts only `accessToken`/`refreshToken` inside a provider credentials JSON blob, leaving every other field (subdomain, cloudId, expiresAt, reauthRequired, owner/repo, workspaceId, …) plaintext — those are needed unencrypted for display, comparisons, and API request construction. */
export function encryptCredentials<T extends TokenFields>(credentials: T): T {
  return {
    ...credentials,
    accessToken: encryptToken(credentials.accessToken),
    ...(credentials.refreshToken !== undefined
      ? { refreshToken: encryptToken(credentials.refreshToken) }
      : {}),
  };
}

/** Inverse of `encryptCredentials`. Tolerates a row not yet migrated (see `decryptToken`). */
export function decryptCredentials<T extends TokenFields>(credentials: T): T {
  return {
    ...credentials,
    accessToken: decryptToken(credentials.accessToken),
    ...(credentials.refreshToken !== undefined
      ? { refreshToken: decryptToken(credentials.refreshToken) }
      : {}),
  };
}
