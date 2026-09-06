import { describe, expect, it, vi } from "vitest";
import { loadFreshLinearCredentials, LinearReauthRequiredError, markReauthRequired } from "../src/tokenLifecycle";
import type { LinearCredentials } from "../src/types";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Emulates Postgres jsonb `equals` semantics (deep, order-independent) closely enough for these tests. */
function createFakePrisma(initial: LinearCredentials) {
  let row: LinearCredentials = structuredClone(initial);
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => ({ credentials: structuredClone(row) })),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { credentials: { equals: LinearCredentials } };
          data: { credentials: LinearCredentials };
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

describe("loadFreshLinearCredentials", () => {
  it("returns credentials unchanged when not flagged for reauth", async () => {
    const prisma = createFakePrisma({ accessToken: "access-1", tokenType: "Bearer", scope: "read" });

    const credentials = await loadFreshLinearCredentials(prisma as never, "integration-1");

    expect(credentials.accessToken).toBe("access-1");
  });

  it("throws without a network call once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({
      accessToken: "access-1",
      tokenType: "Bearer",
      scope: "read",
      reauthRequired: true,
    });

    await expect(loadFreshLinearCredentials(prisma as never, "integration-1")).rejects.toBeInstanceOf(
      LinearReauthRequiredError,
    );
  });
});

describe("markReauthRequired", () => {
  it("adopts the already-rotated token instead of marking reauth when another process reconnected", async () => {
    const prisma = createFakePrisma({ accessToken: "access-already-rotated", tokenType: "Bearer", scope: "read" });
    const failedCredentials: LinearCredentials = { accessToken: "access-stale", tokenType: "Bearer", scope: "read" };

    const credentials = await markReauthRequired(prisma as never, "integration-1", failedCredentials);

    expect(credentials.accessToken).toBe("access-already-rotated");
    expect(prisma._getRow().reauthRequired).toBeUndefined();
  });

  it("marks reauthRequired and throws when the DB still holds the token that just failed", async () => {
    const failed: LinearCredentials = { accessToken: "access-1", tokenType: "Bearer", scope: "read" };
    const prisma = createFakePrisma(failed);

    await expect(markReauthRequired(prisma as never, "integration-1", failed)).rejects.toBeInstanceOf(
      LinearReauthRequiredError,
    );

    expect(prisma._getRow().reauthRequired).toBe(true);
    expect(prisma._getRow().accessToken).toBe("access-1"); // preserved, not deleted
  });

  it("does not re-mark or throw twice once reauthRequired is already set", async () => {
    const prisma = createFakePrisma({
      accessToken: "access-1",
      tokenType: "Bearer",
      scope: "read",
      reauthRequired: true,
    });

    await expect(
      markReauthRequired(prisma as never, "integration-1", {
        accessToken: "access-1",
        tokenType: "Bearer",
        scope: "read",
      }),
    ).rejects.toBeInstanceOf(LinearReauthRequiredError);
  });
});
