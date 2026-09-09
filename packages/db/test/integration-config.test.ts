import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isConfigurableIntegrationProvider,
} from "../src/integration-config";

const ORIGINAL_SECRET = process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY = "test-nextauth-secret";
});

afterEach(() => {
  process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY = ORIGINAL_SECRET;
});

describe("isConfigurableIntegrationProvider", () => {
  it("accepts zendesk, jira, and slack", () => {
    expect(isConfigurableIntegrationProvider("zendesk")).toBe(true);
    expect(isConfigurableIntegrationProvider("jira")).toBe(true);
    expect(isConfigurableIntegrationProvider("slack")).toBe(true);
  });

  it("rejects linear and unknown values", () => {
    expect(isConfigurableIntegrationProvider("linear")).toBe(false);
    expect(isConfigurableIntegrationProvider("bogus")).toBe(false);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext secret", () => {
    const ciphertext = encryptSecret("super-secret-value");
    expect(ciphertext).not.toContain("super-secret-value");
    expect(decryptSecret(ciphertext)).toBe("super-secret-value");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const first = encryptSecret("same-value");
    const second = encryptSecret("same-value");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("same-value");
    expect(decryptSecret(second)).toBe("same-value");
  });

  it("throws when INTEGRATION_CONFIG_ENCRYPTION_KEY is missing", () => {
    delete process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY;
    expect(() => encryptSecret("value")).toThrow(
      /INTEGRATION_CONFIG_ENCRYPTION_KEY/,
    );
  });

  it("throws on tampered ciphertext instead of returning garbage", () => {
    const ciphertext = encryptSecret("value");
    const [iv, authTag, body] = ciphertext.split(".");
    const tampered = [iv, authTag, `${body}xx`].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
