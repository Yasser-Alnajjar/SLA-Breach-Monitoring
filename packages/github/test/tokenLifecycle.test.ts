import { describe, expect, it, vi } from "vitest";
import { GithubReauthRequiredError, loadFreshGithubCredentials, markReauthRequired } from "../src/tokenLifecycle";
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

describe("loadFreshGithubCredentials", () => {
  it("returns credentials unchanged when not flagged for reauth", async () => {
    const prisma = createFakePrisma(baseCredentials);

    const credentials = await loadFreshGithubCredentials(prisma as never, "integration-1");

    expect(credentials.accessToken).toBe("access-1");
  });

  it("throws without a network call once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({ ...baseCredentials, reauthRequired: true });

    await expect(loadFreshGithubCredentials(prisma as never, "integration-1")).rejects.toBeInstanceOf(
      GithubReauthRequiredError,
    );
  });
});

describe("markReauthRequired", () => {
  it("adopts the already-rotated token instead of marking reauth when another process reconnected", async () => {
    const prisma = createFakePrisma({ ...baseCredentials, accessToken: "access-already-rotated" });
    const failedCredentials: GithubCredentials = { ...baseCredentials, accessToken: "access-stale" };

    const credentials = await markReauthRequired(prisma as never, "integration-1", failedCredentials);

    expect(credentials.accessToken).toBe("access-already-rotated");
    expect(prisma._getRow().reauthRequired).toBeUndefined();
  });

  it("marks reauthRequired and throws when the DB still holds the token that just failed", async () => {
    const prisma = createFakePrisma(baseCredentials);

    await expect(markReauthRequired(prisma as never, "integration-1", baseCredentials)).rejects.toBeInstanceOf(
      GithubReauthRequiredError,
    );

    expect(prisma._getRow().reauthRequired).toBe(true);
    expect(prisma._getRow().accessToken).toBe("access-1"); // preserved, not deleted
  });

  it("does not re-mark or throw twice once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({ ...baseCredentials, reauthRequired: true });

    await expect(markReauthRequired(prisma as never, "integration-1", baseCredentials)).rejects.toBeInstanceOf(
      GithubReauthRequiredError,
    );
  });
});
