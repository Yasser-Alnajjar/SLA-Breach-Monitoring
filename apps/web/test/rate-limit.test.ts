import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimitState, checkRateLimit, clientIpFromHeaders, getClientIp } from "../src/lib/rate-limit";

beforeEach(() => {
  _resetRateLimitState();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit within the window", () => {
    const now = 1_000_000;
    expect(checkRateLimit("k", 3, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit("k", 3, 60_000, now + 10).allowed).toBe(true);
    expect(checkRateLimit("k", 3, 60_000, now + 20).allowed).toBe(true);
  });

  it("rejects once the limit is exceeded within the window, with a retry-after", () => {
    const now = 1_000_000;
    checkRateLimit("k", 2, 60_000, now);
    checkRateLimit("k", 2, 60_000, now + 10);

    const result = checkRateLimit("k", 2, 60_000, now + 20);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the count once the window has elapsed", () => {
    const now = 1_000_000;
    checkRateLimit("k", 1, 60_000, now);
    expect(checkRateLimit("k", 1, 60_000, now + 10).allowed).toBe(false);
    expect(checkRateLimit("k", 1, 60_000, now + 60_001).allowed).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const now = 1_000_000;
    checkRateLimit("a", 1, 60_000, now);
    expect(checkRateLimit("a", 1, 60_000, now + 1).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 60_000, now + 1).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("reads the address the reverse proxy appended, not one the client sent", () => {
    // The client sent "X-Forwarded-For: 198.51.100.99"; the proxy appended the real peer.
    const request = new Request("https://app.example.com/api/sign-up", {
      headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.5" },
    });
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("reads a single-entry X-Forwarded-For", () => {
    const request = new Request("https://app.example.com/api/sign-up", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("falls back to X-Real-IP when X-Forwarded-For is absent", () => {
    const request = new Request("https://app.example.com/api/sign-up", {
      headers: { "x-real-ip": "203.0.113.7" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to a shared bucket when neither header is present", () => {
    const request = new Request("https://app.example.com/api/sign-up");
    expect(getClientIp(request)).toBe("unknown");
  });
});

describe("clientIpFromHeaders", () => {
  it("skips one entry per trusted proxy, counting from the right", () => {
    // Client → CDN → Caddy → web: Caddy appended the CDN's address.
    expect(clientIpFromHeaders("198.51.100.99, 203.0.113.5, 192.0.2.10", null, 2)).toBe("203.0.113.5");
  });

  it("uses the leftmost entry when the chain is shorter than the trusted count", () => {
    expect(clientIpFromHeaders("203.0.113.5", null, 2)).toBe("203.0.113.5");
  });

  it("ignores empty entries", () => {
    expect(clientIpFromHeaders("203.0.113.5, ", null, 1)).toBe("203.0.113.5");
  });

  it("reads TRUSTED_PROXY_COUNT from the environment, defaulting to 1", () => {
    const previous = process.env.TRUSTED_PROXY_COUNT;
    try {
      process.env.TRUSTED_PROXY_COUNT = "2";
      expect(clientIpFromHeaders("198.51.100.99, 203.0.113.5, 192.0.2.10", null)).toBe("203.0.113.5");
      process.env.TRUSTED_PROXY_COUNT = "not a number";
      expect(clientIpFromHeaders("198.51.100.99, 203.0.113.5, 192.0.2.10", null)).toBe("192.0.2.10");
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_COUNT;
      else process.env.TRUSTED_PROXY_COUNT = previous;
    }
  });
});
