import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadFreshZendeskCredentials,
  refreshAfterUnauthorized,
  ZendeskReauthRequiredError,
} from "../src/tokenLifecycle";
import type { ZendeskCredentials } from "../src/types";

const config = { clientId: "client-123", clientSecret: "secret-xyz", redirectUri: "https://app.example.com/cb" };

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Emulates Postgres jsonb `equals` semantics (deep, order-independent) closely enough for these tests. */
function createFakePrisma(initial: ZendeskCredentials) {
  let row: ZendeskCredentials = structuredClone(initial);
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => ({ credentials: structuredClone(row) })),
      updateMany: vi.fn(async ({ where, data }: { where: { credentials: { equals: ZendeskCredentials } }; data: { credentials: ZendeskCredentials } }) => {
        if (!deepEqual(row, where.credentials.equals)) return { count: 0 };
        row = structuredClone(data.credentials);
        return { count: 1 };
      }),
    },
    _getRow: () => row,
  } as const;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadFreshZendeskCredentials", () => {
  it("returns credentials unchanged when nowhere near expiry", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshZendeskCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing expiresAt as non-expiring (existing integrations without refresh support)", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshZendeskCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proactively refreshes and persists when the access token is about to expire", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() + 30 * 1000, // inside the safety margin
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          access_token: "access-2",
          refresh_token: "refresh-2",
          token_type: "bearer",
          scope: "read",
          expires_in: 3600,
        }),
      ),
    );

    const credentials = await loadFreshZendeskCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-2");
    expect(credentials.refreshToken).toBe("refresh-2");
    expect(prisma._getRow().accessToken).toBe("access-2");
  });

  it("does not attempt to refresh when there is no refresh token on file", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() - 1000, // already expired
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshZendeskCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the integration reauthRequired and throws when the refresh token is invalid/expired/revoked", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() - 1000,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "invalid_grant" })));

    await expect(loadFreshZendeskCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      ZendeskReauthRequiredError,
    );

    expect(prisma._getRow().reauthRequired).toBe(true);
    // credentials are preserved, not deleted
    expect(prisma._getRow().refreshToken).toBe("refresh-1");
  });

  it("does not repeatedly call Zendesk once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() - 1000,
      reauthRequired: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadFreshZendeskCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      ZendeskReauthRequiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("de-dupes concurrent refreshes in the same process into a single Zendesk call", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
      expiresAt: Date.now() + 30 * 1000,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "access-2", refresh_token: "refresh-2", token_type: "bearer", scope: "read" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      loadFreshZendeskCredentials(prisma as never, "integration-concurrent", config),
      loadFreshZendeskCredentials(prisma as never, "integration-concurrent", config),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.accessToken).toBe("access-2");
    expect(b.accessToken).toBe("access-2");
  });
});

describe("refreshAfterUnauthorized", () => {
  it("adopts the already-rotated token instead of refreshing again when another process won the race", async () => {
    const prisma = createFakePrisma({
      subdomain: "acme",
      accessToken: "access-already-rotated",
      refreshToken: "refresh-2",
      tokenType: "bearer",
      scope: "read",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const failedCredentials: ZendeskCredentials = {
      subdomain: "acme",
      accessToken: "access-stale",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
    };

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, failedCredentials);

    expect(credentials.accessToken).toBe("access-already-rotated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks reauthRequired instead of silently retrying when there is no refresh token to fall back on", async () => {
    const failed: ZendeskCredentials = {
      subdomain: "acme",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read",
    };
    const prisma = createFakePrisma(failed);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      refreshAfterUnauthorized(prisma as never, "integration-1", config, failed),
    ).rejects.toBeInstanceOf(ZendeskReauthRequiredError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma._getRow().reauthRequired).toBe(true);
    expect(prisma._getRow().accessToken).toBe("access-1"); // preserved, not deleted
  });

  it("refreshes when the DB still holds the token that just failed", async () => {
    const failed: ZendeskCredentials = {
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
    };
    const prisma = createFakePrisma(failed);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "access-2", token_type: "bearer", scope: "read" })),
    );

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, failed);
    expect(credentials.accessToken).toBe("access-2");
  });
});
