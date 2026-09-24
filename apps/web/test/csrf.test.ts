import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn(async () => null) }));

const { isSameOriginRequest, isStateChangingMethod } =
  await import("../src/lib/csrf");
const { _resetRateLimitState } = await import("../src/lib/rate-limit");
const { proxy } = await import("../src/proxy");

const APP_URL = "https://app.example.com";

function request(
  path: string,
  {
    method = "POST",
    headers = {},
  }: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(`${APP_URL}${path}`, { method, headers });
}

describe("isStateChangingMethod", () => {
  it("treats GET/HEAD/OPTIONS as safe and everything else as state-changing", () => {
    for (const m of ["GET", "HEAD", "OPTIONS", "get"])
      expect(isStateChangingMethod(m)).toBe(false);
    for (const m of ["POST", "PUT", "PATCH", "DELETE"])
      expect(isStateChangingMethod(m)).toBe(true);
  });
});

describe("isSameOriginRequest", () => {
  it("accepts an Origin matching NEXTAUTH_URL", () => {
    expect(
      isSameOriginRequest(
        request("/x", { headers: { origin: APP_URL } }),
        APP_URL,
      ),
    ).toBe(true);
  });

  it("rejects a foreign Origin even when Host is ours", () => {
    const req = request("/x", {
      headers: { origin: "https://evil.example", host: "app.example.com" },
    });
    expect(isSameOriginRequest(req, APP_URL)).toBe(false);
  });

  it("rejects a sibling subdomain (same-site but cross-origin)", () => {
    const req = request("/x", {
      headers: { origin: "https://evil.example.com" },
    });
    expect(isSameOriginRequest(req, APP_URL)).toBe(false);
  });

  it("rejects a different scheme or port on the same host", () => {
    expect(
      isSameOriginRequest(
        request("/x", { headers: { origin: "http://app.example.com" } }),
        APP_URL,
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        request("/x", { headers: { origin: "https://app.example.com:8443" } }),
        APP_URL,
      ),
    ).toBe(false);
  });

  it("rejects a missing Origin with no Referer, and a literal 'null' Origin", () => {
    expect(isSameOriginRequest(request("/x"), APP_URL)).toBe(false);
    expect(
      isSameOriginRequest(
        request("/x", { headers: { origin: "null" } }),
        APP_URL,
      ),
    ).toBe(false);
  });

  it("does not fall back to Referer when an Origin header is present but unusable", () => {
    const req = request("/x", {
      headers: { origin: "null", referer: `${APP_URL}/settings` },
    });
    expect(isSameOriginRequest(req, APP_URL)).toBe(false);
  });

  it("falls back to Referer's origin when Origin is absent", () => {
    expect(
      isSameOriginRequest(
        request("/x", { headers: { referer: `${APP_URL}/settings` } }),
        APP_URL,
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        request("/x", { headers: { referer: "https://evil.example/page" } }),
        APP_URL,
      ),
    ).toBe(false);
  });

  it("accepts an Origin matching the addressed host (dev over a LAN IP / tunnel)", () => {
    const req = request("/x", {
      headers: {
        origin: "http://192.168.1.46:5465",
        host: "192.168.1.46:5465",
      },
    });
    expect(isSameOriginRequest(req, "http://localhost:5465")).toBe(true);
  });

  it("prefers X-Forwarded-Host over Host behind the reverse proxy", () => {
    const req = request("/x", {
      headers: {
        origin: "https://sla.customer.io",
        host: "web:5465",
        "x-forwarded-host": "sla.customer.io",
      },
    });
    expect(isSameOriginRequest(req, undefined)).toBe(true);
  });
});

describe("proxy Origin check", () => {
  const originalAppUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_URL = APP_URL;
    _resetRateLimitState();
  });
  afterEach(() => {
    process.env.NEXTAUTH_URL = originalAppUrl;
  });

  it.each([
    ["POST", "/api/settings/email"],
    ["DELETE", "/api/settings/engineering-target"],
    ["POST", "/api/integrations/zendesk/disconnect"],
    ["POST", "/api/integrations/jira/config"],
    ["POST", "/api/integrations/slack/channel"],
    ["POST", "/api/sign-up"],
  ])("403s a cross-origin %s %s before auth runs", async (method, path) => {
    const response = await proxy(
      request(path, { method, headers: { origin: "https://evil.example" } }),
    );
    expect(response.status).toBe(403);
  });

  it("lets a same-origin state-changing request through to the auth check", async () => {
    const response = await proxy(
      request("/api/settings/email", { headers: { origin: APP_URL } }),
    );
    // No session in this test, so the next gate (auth) answers — the point is it isn't the CSRF 403.
    expect(response.status).toBe(401);
  });

  it("does not require Origin on GET requests", async () => {
    const response = await proxy(
      request("/api/settings/email", { method: "GET" }),
    );
    expect(response.status).toBe(401);
  });

  it("exempts webhooks, which are server-to-server with no Origin", async () => {
    const response = await proxy(request("/api/webhooks/zendesk/abc"));
    expect(response.status).not.toBe(403);
  });

  it("exempts NextAuth's own endpoints, which carry their own CSRF token", async () => {
    const response = await proxy(request("/api/auth/signout"));
    expect(response.status).not.toBe(403);
  });
});
