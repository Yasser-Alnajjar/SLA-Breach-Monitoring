import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptCredentials,
  decryptToken,
  encryptCredentials,
  encryptToken,
  IntegrationCredentialsUnreadableError,
  isEncryptedToken,
} from "../src/integration-credentials";

const ORIGINAL_SECRET = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "test-integration-token-secret";
});

afterEach(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = ORIGINAL_SECRET;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a plaintext token", () => {
    const ciphertext = encryptToken("super-secret-access-token");
    expect(ciphertext).not.toContain("super-secret-access-token");
    expect(decryptToken(ciphertext)).toBe("super-secret-access-token");
  });

  it("marks encrypted output with the enc:v1: prefix", () => {
    const ciphertext = encryptToken("value");
    expect(isEncryptedToken(ciphertext)).toBe(true);
    expect(ciphertext.startsWith("enc:v1:")).toBe(true);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const first = encryptToken("same-value");
    const second = encryptToken("same-value");
    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe("same-value");
    expect(decryptToken(second)).toBe("same-value");
  });

  it("tolerates a not-yet-migrated plaintext value, returning it unchanged", () => {
    expect(isEncryptedToken("plain-legacy-token")).toBe(false);
    expect(decryptToken("plain-legacy-token")).toBe("plain-legacy-token");
  });

  it("throws IntegrationCredentialsUnreadableError, not the raw crypto error, when the encryption key is missing", () => {
    const ciphertext = encryptToken("value");
    delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
    expect(() => decryptToken(ciphertext)).toThrow(IntegrationCredentialsUnreadableError);
  });

  it("throws IntegrationCredentialsUnreadableError on corrupted ciphertext", () => {
    const ciphertext = encryptToken("value");
    const tampered = `${ciphertext}xx`;
    expect(() => decryptToken(tampered)).toThrow(IntegrationCredentialsUnreadableError);
  });
});

describe("encryptCredentials / decryptCredentials", () => {
  it("encrypts accessToken and refreshToken, leaving every other field plaintext", () => {
    const credentials = {
      subdomain: "acme",
      accessToken: "access-123",
      refreshToken: "refresh-456",
      tokenType: "bearer",
      scope: "read",
      expiresAt: 1234567890,
    };

    const encrypted = encryptCredentials(credentials);

    expect(isEncryptedToken(encrypted.accessToken)).toBe(true);
    expect(isEncryptedToken(encrypted.refreshToken)).toBe(true);
    expect(encrypted.subdomain).toBe("acme");
    expect(encrypted.tokenType).toBe("bearer");
    expect(encrypted.scope).toBe("read");
    expect(encrypted.expiresAt).toBe(1234567890);

    expect(decryptCredentials(encrypted)).toEqual(credentials);
  });

  it("handles credentials with no refreshToken (e.g. Intercom/Linear)", () => {
    const credentials = { accessToken: "access-only", tokenType: "bearer", scope: "read" };
    const encrypted = encryptCredentials(credentials);

    expect(isEncryptedToken(encrypted.accessToken)).toBe(true);
    expect(encrypted.refreshToken).toBeUndefined();
    expect(decryptCredentials(encrypted)).toEqual(credentials);
  });

  it("produces a different ciphertext each round (random IV), never equal to a prior encryption of the same plaintext", () => {
    const credentials = { accessToken: "same-token", refreshToken: "same-refresh", tokenType: "bearer", scope: "read" };
    const first = encryptCredentials(credentials);
    const second = encryptCredentials(credentials);

    expect(first.accessToken).not.toBe(second.accessToken);
    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it("decryptCredentials tolerates a not-yet-migrated plaintext row", () => {
    const credentials = { accessToken: "legacy-plaintext", refreshToken: "legacy-refresh", tokenType: "bearer", scope: "read" };
    expect(decryptCredentials(credentials)).toEqual(credentials);
  });
});
