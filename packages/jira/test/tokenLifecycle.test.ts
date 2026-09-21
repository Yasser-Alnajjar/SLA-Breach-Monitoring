import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptCredentials, encryptCredentials, isEncryptedToken } from "@sla/db";
import { loadFreshJiraCredentials, refreshAfterUnauthorized, JiraReauthRequiredError } from "../src/tokenLifecycle";
import type { JiraCredentials } from "../src/types";

const config = { clientId: "client-123", clientSecret: "secret-xyz", redirectUri: "https://app.example.com/cb" };

const ORIGINAL_ENCRYPTION_KEY = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "test-integration-token-secret";
});

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/**
 * Emulates Postgres jsonb `equals` semantics (deep, order-independent)
 * closely enough for these tests. Seeds the row already encrypted at rest
 * (mirroring a migrated production row), so the CAS `where.credentials.equals`
 * comparison in tokenLifecycle.ts is exercised against real ciphertext —
 * `_getRow()` decrypts back to plaintext for assertions, since that's what
 * every existing assertion below expects to read.
 */
function createFakePrisma(initial: JiraCredentials) {
  let row: JiraCredentials = encryptCredentials(structuredClone(initial));
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => ({ credentials: structuredClone(row) })),
      updateMany: vi.fn(async ({ where, data }: { where: { credentials: { equals: JiraCredentials } }; data: { credentials: JiraCredentials } }) => {
        if (!deepEqual(row, where.credentials.equals)) return { count: 0 };
        row = structuredClone(data.credentials);
        return { count: 1 };
      }),
    },
    _getRow: () => decryptCredentials(structuredClone(row)),
    _getRawRow: () => structuredClone(row),
  } as const;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
});

describe("credentials at rest", () => {
  it("stores accessToken/refreshToken encrypted, never plaintext, after a refresh", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() + 30 * 1000,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          access_token: "access-2",
          refresh_token: "refresh-2",
          token_type: "bearer",
          scope: "read:jira-work offline_access",
          expires_in: 3600,
        }),
      ),
    );

    await loadFreshJiraCredentials(prisma as never, "integration-1", config);

    expect(isEncryptedToken(prisma._getRawRow().accessToken)).toBe(true);
    expect(isEncryptedToken(prisma._getRawRow().refreshToken!)).toBe(true);
  });
});

describe("loadFreshJiraCredentials", () => {
  it("returns credentials unchanged when nowhere near expiry", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshJiraCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing expiresAt as non-expiring (existing integrations without refresh support)", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshJiraCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proactively refreshes and persists when the access token is about to expire", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() + 30 * 1000, // inside the safety margin
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          access_token: "access-2",
          refresh_token: "refresh-2",
          token_type: "bearer",
          scope: "read:jira-work offline_access",
          expires_in: 3600,
        }),
      ),
    );

    const credentials = await loadFreshJiraCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-2");
    expect(credentials.refreshToken).toBe("refresh-2");
    expect(credentials.cloudId).toBe("cloud-1");
    expect(prisma._getRow().accessToken).toBe("access-2");
  });

  it("does not attempt to refresh when there is no refresh token on file", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() - 1000, // already expired
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const credentials = await loadFreshJiraCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the integration reauthRequired and throws when the refresh token is invalid/expired/revoked", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() - 1000,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "invalid_grant" })));

    await expect(loadFreshJiraCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      JiraReauthRequiredError,
    );

    expect(prisma._getRow().reauthRequired).toBe(true);
    // credentials are preserved, not deleted
    expect(prisma._getRow().refreshToken).toBe("refresh-1");
  });

  it("does not repeatedly call Jira once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() - 1000,
      reauthRequired: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadFreshJiraCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      JiraReauthRequiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("de-dupes concurrent refreshes in the same process into a single Jira call", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
      expiresAt: Date.now() + 30 * 1000,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: "access-2",
        refresh_token: "refresh-2",
        token_type: "bearer",
        scope: "read:jira-work offline_access",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      loadFreshJiraCredentials(prisma as never, "integration-concurrent", config),
      loadFreshJiraCredentials(prisma as never, "integration-concurrent", config),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.accessToken).toBe("access-2");
    expect(b.accessToken).toBe("access-2");
  });
});

describe("refreshAfterUnauthorized", () => {
  it("adopts the already-rotated token instead of refreshing again when another process won the race", async () => {
    const prisma = createFakePrisma({
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-already-rotated",
      refreshToken: "refresh-2",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const failedCredentials: JiraCredentials = {
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-stale",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
    };

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, failedCredentials);

    expect(credentials.accessToken).toBe("access-already-rotated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks reauthRequired instead of silently retrying when there is no refresh token to fall back on", async () => {
    const failed: JiraCredentials = {
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
    };
    const prisma = createFakePrisma(failed);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshAfterUnauthorized(prisma as never, "integration-1", config, failed)).rejects.toBeInstanceOf(
      JiraReauthRequiredError,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma._getRow().reauthRequired).toBe(true);
    expect(prisma._getRow().accessToken).toBe("access-1"); // preserved, not deleted
  });

  it("refreshes when the DB still holds the token that just failed", async () => {
    const failed: JiraCredentials = {
      cloudId: "cloud-1",
      siteUrl: "https://acme.atlassian.net",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read:jira-work offline_access",
    };
    const prisma = createFakePrisma(failed);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { access_token: "access-2", token_type: "bearer", scope: "read:jira-work offline_access" }),
      ),
    );

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, failed);
    expect(credentials.accessToken).toBe("access-2");
    expect(credentials.cloudId).toBe("cloud-1");
  });
});
