/**
 * `withOrganizationSlaLock` (roadmap step 0.7, E-3): normalization and the
 * commitment/cycle/evaluation/notification pipeline tail for one
 * organization must never run concurrently from two call sites — the
 * worker's own cycle, a webhook delivery, and the onboarding source-sync
 * backfill routes all write the same Case/NormalizedEvent/Commitment rows.
 *
 * Real Postgres, like source-sync-evaluation.test.ts. Needs a migrated
 * database at TEST_DATABASE_URL whose name contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("withOrganizationSlaLock (real Postgres)", () => {
  let prisma: PrismaClient;
  let db: typeof import("@sla/db");

  let organizationId: string;

  beforeAll(async () => {
    const name = new URL(TEST_DATABASE_URL!).pathname.replace(/^\//, "");
    if (!/test/i.test(name)) {
      throw new Error(`TEST_DATABASE_URL points at database "${name}"; this suite truncates every table.`);
    }
    // @sla/db builds its connection from DATABASE_URL at import time.
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    db = await import("@sla/db");
    prisma = db.getPrismaClient();
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`,
    );

    organizationId = (await prisma.organization.create({ data: { name: "Lock Org" } })).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("serializes two concurrent runs for the same organization — no interleaving", async () => {
    // A classic critical-section race: increment-with-delay-then-write. Two
    // callers running without mutual exclusion would both read `0`, both
    // compute `1`, and the second write would clobber the first — this is
    // exactly the shape of the "no unique key, concurrent runs duplicate"
    // race the lock exists to prevent (E-3). Held serially, the final value
    // must be `2`.
    let counter = 0;
    const observedStarts: number[] = [];

    const criticalSection = async (): Promise<void> => {
      await db.withOrganizationSlaLock(prisma, organizationId, async () => {
        observedStarts.push(counter);
        const current = counter;
        await new Promise((resolve) => setTimeout(resolve, 50));
        counter = current + 1;
      });
    };

    await Promise.all([criticalSection(), criticalSection()]);

    expect(counter).toBe(2);
    // The second caller must have observed the first caller's completed
    // write (1), never the stale value (0) a race would produce.
    expect(observedStarts.sort()).toEqual([0, 1]);
  });

  it("does not serialize two different organizations against each other", async () => {
    const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other Lock Org" } })).id;

    const startedAt: Record<string, number> = {};
    const start = Date.now();

    const hold = async (orgId: string, key: string): Promise<void> => {
      await db.withOrganizationSlaLock(prisma, orgId, async () => {
        startedAt[key] = Date.now() - start;
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    };

    await Promise.all([hold(organizationId, "a"), hold(otherOrganizationId, "b")]);

    // Both should start almost immediately — a different organization's lock
    // never makes this one wait.
    expect(startedAt.a).toBeLessThan(50);
    expect(startedAt.b).toBeLessThan(50);
  });
});
