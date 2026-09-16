import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GithubReauthRequiredError,
  loadFreshGithubCredentials,
  refreshAfterUnauthorized,
} from "../src/tokenLifecycle";
import type { GithubCredentials } from "../src/types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Emulates Postgres jsonb `equals` semantics (deep, order-independent) closely enough for these tests. */
function createFakePrisma(initial: GithubCredentials) {
  let row: GithubCredentials = structuredClone(initial);
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => ({ credentials: structuredClone(row) })),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { credentials: { equals: GithubCredentials } };
          data: { credentials: GithubCredentials };
        }) => {
          if (!deepEqual(row, where.credentials.equals)) return { count: 0 };
          row = structuredClone(data.credentials);
          return { count: 1 };
        },
      ),
    },
    _getRow: () => row,
  } as const;
}

const baseCredentials: GithubCredentials = {
  accessToken: "access-1",
  tokenType: "bearer",
  scope: "repo",
  owner: "acme",
  repo: "widgets",
};

const expiringCredentials: GithubCredentials = {
  ...baseCredentials,
  scope: "",
  refreshToken: "refresh-1",
  expiresAt: Date.now() - 1000,
};

const config = { clientId: "client-123", clientSecret: "secret-xyz" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadFreshGithubCredentials", () => {
  it("returns non-expiring credentials unchanged without a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const prisma = createFakePrisma(baseCredentials);

    const credentials = await loadFreshGithubCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an unexpired GitHub App token unchanged", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const prisma = createFakePrisma({ ...expiringCredentials, expiresAt: Date.now() + 60 * 60 * 1000 });

    await loadFreshGithubCredentials(prisma as never, "integration-1", config);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a token near expiry and persists the rotated tokens, keeping owner/repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { access_token: "access-2", token_type: "bearer", expires_in: 28800, refresh_token: "refresh-2" }),
      ),
    );
    const prisma = createFakePrisma(expiringCredentials);

    const credentials = await loadFreshGithubCredentials(prisma as never, "integration-1", config);

    expect(credentials.accessToken).toBe("access-2");
    expect(prisma._getRow()).toMatchObject({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      owner: "acme",
      repo: "widgets",
    });
    expect(prisma._getRow().expiresAt).toBeGreaterThan(Date.now());
  });

  it("marks reauth when GitHub rejects the refresh token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "bad_refresh_token" })));
    const prisma = createFakePrisma(expiringCredentials);

    await expect(loadFreshGithubCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      GithubReauthRequiredError,
    );
    expect(prisma._getRow().reauthRequired).toBe(true);
  });

  it("leaves reauth unset when a refresh fails for a non-token reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: "incorrect_client_credentials" })));
    const prisma = createFakePrisma(expiringCredentials);

    await expect(loadFreshGithubCredentials(prisma as never, "integration-1", config)).rejects.toMatchObject({
      name: "GithubOAuthError",
    });
    expect(prisma._getRow().reauthRequired).toBeUndefined();
  });

  it("throws without a network call once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({ ...baseCredentials, reauthRequired: true });

    await expect(loadFreshGithubCredentials(prisma as never, "integration-1", config)).rejects.toBeInstanceOf(
      GithubReauthRequiredError,
    );
  });
});

describe("refreshAfterUnauthorized", () => {
  it("adopts the already-rotated token instead of refreshing when another process got there first", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const prisma = createFakePrisma({ ...baseCredentials, accessToken: "access-already-rotated" });
    const failedCredentials: GithubCredentials = { ...baseCredentials, accessToken: "access-stale" };

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, failedCredentials);

    expect(credentials.accessToken).toBe("access-already-rotated");
    expect(prisma._getRow().reauthRequired).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks reauthRequired for a 401 on a token with no refresh token", async () => {
    const prisma = createFakePrisma(baseCredentials);

    await expect(
      refreshAfterUnauthorized(prisma as never, "integration-1", config, baseCredentials),
    ).rejects.toBeInstanceOf(GithubReauthRequiredError);

    expect(prisma._getRow().reauthRequired).toBe(true);
    expect(prisma._getRow().accessToken).toBe("access-1"); // preserved, not deleted
  });

  it("refreshes after a 401 when a refresh token is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { access_token: "access-2", expires_in: 28800, refresh_token: "refresh-2" }),
      ),
    );
    const current = { ...expiringCredentials, expiresAt: Date.now() + 60 * 60 * 1000 };
    const prisma = createFakePrisma(current);

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, current);

    expect(credentials.accessToken).toBe("access-2");
    expect(prisma._getRow().refreshToken).toBe("refresh-2");
  });

  it("adopts tokens another instance rotated when its own single-use refresh token was already spent", async () => {
    const prisma = createFakePrisma(expiringCredentials);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        // Simulates another instance winning the race and rotating first.
        await prisma.integration.updateMany({
          where: { credentials: { equals: prisma._getRow() } },
          data: { credentials: { ...expiringCredentials, accessToken: "access-other", refreshToken: "refresh-other" } },
        });
        return jsonResponse(200, { error: "bad_refresh_token" });
      }),
    );

    const credentials = await refreshAfterUnauthorized(prisma as never, "integration-1", config, expiringCredentials);

    expect(credentials.accessToken).toBe("access-other");
    expect(prisma._getRow().reauthRequired).toBeUndefined();
  });

  it("does not re-mark or refresh once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({ ...baseCredentials, reauthRequired: true });

    await expect(
      refreshAfterUnauthorized(prisma as never, "integration-1", config, baseCredentials),
    ).rejects.toBeInstanceOf(GithubReauthRequiredError);
  });
});
