import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Shared AES-256-GCM primitives behind every per-organization secret this
 * package encrypts at rest (`IntegrationConfig.clientSecret`,
 * `OrganizationEmailSettings.password`, …). Each caller derives its own key
 * from its own dedicated deployment secret and salt (see
 * `integration-config.ts`/`email-settings.ts`) so rotating one secret never
 * invalidates another feature's ciphertext — this module only holds the
 * encryption primitive, not the env var wiring or error messages, which stay
 * call-site-specific so a decrypt failure can name the right secret to fix.
 */
const ALGORITHM = "aes-256-gcm";

export function deriveEncryptionKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, 32);
}

/** Output is base64url(iv) + "." + base64url(authTag) + "." + base64url(ciphertext). */
export function aesGcmEncrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((buf) => buf.toString("base64url"))
    .join(".");
}

export function aesGcmDecrypt(key: Buffer, encoded: string): string {
  const [ivPart, authTagPart, ciphertextPart] = encoded.split(".");
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
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
