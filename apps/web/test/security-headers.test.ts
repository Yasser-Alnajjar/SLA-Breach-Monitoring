import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "../security-headers.mjs";

function asMap(isDev: boolean) {
  return new Map(buildSecurityHeaders({ isDev }).map((h) => [h.key, h.value]));
}

describe("buildSecurityHeaders", () => {
  it("sets the baseline headers in production", () => {
    const headers = asMap(false);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Strict-Transport-Security")).toMatch(/max-age=\d+/);
  });

  it("locks down framing, plugins, base-uri, and form targets in the CSP", () => {
    const csp = asMap(false).get("Content-Security-Policy")!;
    for (const directive of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  it("never allows eval or websocket wildcards in production", () => {
    const csp = asMap(false).get("Content-Security-Policy")!;
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/\bwss?:/);
  });

  it("relaxes only what next dev needs, and omits HSTS in dev", () => {
    const headers = asMap(true);
    const csp = headers.get("Content-Security-Policy")!;
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });
});
