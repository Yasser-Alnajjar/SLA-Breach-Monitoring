/**
 * `resetPassword` (roadmap 5.5, guardrail: single-use and race-safe):
 * proves the atomicity claim for real, against a real Postgres — a mock
 * can't demonstrate two requests genuinely racing at the database level.
 * Same shape as `invitation-accept-race.test.ts`.
 *
 * Real Postgres. Needs a migrated database at TEST_DATABASE_URL whose name
 * contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("resetPassword (real Postgres, race safety)", () => {
  let prisma: PrismaClient;
  let db: typeof import("@sla/db");

  beforeAll(async () => {
    const name = new URL(TEST_DATABASE_URL!).pathname.replace(/^\//, "");
    if (!/test/i.test(name)) {
      throw new Error(`TEST_DATABASE_URL points at database "${name}"; this suite truncates every table.`);
    }
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    db = await import("@sla/db");
    prisma = db.getPrismaClient();
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function createUser(email: string) {
    const org = await prisma.organization.create({ data: { name: `Org for ${email}` } });
    return prisma.user.create({
      data: { organizationId: org.id, email, passwordHash: "old-hash", role: "owner" },
    });
  }

  it("the same token consumed twice concurrently updates the password exactly once; the loser gets PasswordResetTokenUsedError", async () => {
    const user = await createUser("racer@example.com");
    const { token } = (await db.requestPasswordReset(prisma, user.email))!;

    const results = await Promise.allSettled([
      db.resetPassword(prisma, { token, passwordHash: "hash-a" }),
      db.resetPassword(prisma, { token, passwordHash: "hash-b" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.PasswordResetTokenUsedError);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(["hash-a", "hash-b"]).toContain(updated.passwordHash);
  });

  it("requesting a second reset invalidates the first token immediately", async () => {
    const user = await createUser("resender@example.com");
    const first = (await db.requestPasswordReset(prisma, user.email))!;
    const second = (await db.requestPasswordReset(prisma, user.email))!;
    expect(second.token).not.toBe(first.token);

    await expect(db.resetPassword(prisma, { token: first.token, passwordHash: "new-hash" })).rejects.toBeInstanceOf(
      db.PasswordResetTokenNotFoundError,
    );

    await db.resetPassword(prisma, { token: second.token, passwordHash: "new-hash" });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).toBe("new-hash");
  });

  it("consuming the same token twice sequentially fails the second time", async () => {
    const user = await createUser("sequential@example.com");
    const { token } = (await db.requestPasswordReset(prisma, user.email))!;

    await db.resetPassword(prisma, { token, passwordHash: "hash-1" });
    await expect(db.resetPassword(prisma, { token, passwordHash: "hash-2" })).rejects.toBeInstanceOf(
      db.PasswordResetTokenUsedError,
    );

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordHash).toBe("hash-1");
  });
});
