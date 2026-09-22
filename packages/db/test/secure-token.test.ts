import { describe, expect, it } from "vitest";
import { generateSecureToken, hashToken } from "../src/secure-token";

describe("generateSecureToken", () => {
  it("returns a URL-safe string with no padding/plus/slash characters", () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateSecureToken()));
    expect(tokens.size).toBe(20);
  });

  it("carries at least 256 bits of entropy (32 raw bytes, base64url-encoded)", () => {
    const token = generateSecureToken();
    // base64url encodes 3 bytes as 4 chars with no padding; 32 bytes -> 43 chars (ceil(32*4/3)).
    expect(token.length).toBe(43);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    const token = generateSecureToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces a different hash for a different token", () => {
    expect(hashToken(generateSecureToken())).not.toBe(hashToken(generateSecureToken()));
  });

  it("never returns the raw token itself", () => {
    const token = generateSecureToken();
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).not.toContain(token);
  });

  it("returns a 64-character lowercase hex string (SHA-256)", () => {
    const hash = hashToken(generateSecureToken());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
