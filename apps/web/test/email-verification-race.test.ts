/**
 * `verifyEmail` (roadmap 5.6, guardrail: single-use and race-safe):
 * proves the atomicity claim for real, against a real Postgres — a mock
 * can't demonstrate two requests genuinely racing at the database level.
 * Same shape as `password-reset-race.test.ts`.
 *
 * Real Postgres. Needs a migrated database at TEST_DATABASE_URL whose name
 * contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("verifyEmail (real Postgres, race safety)", () => {
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
      data: { organizationId: org.id, email, passwordHash: "x", role: "owner" },
    });
  }

  it("the same signup-verification token consumed twice concurrently verifies exactly once; the loser gets EmailVerificationTokenUsedError", async () => {
    const user = await createUser("racer@example.com");
    const { token } = await db.createEmailVerificationToken(prisma, user.id);

    const results = await Promise.allSettled([db.verifyEmail(prisma, token), db.verifyEmail(prisma, token)]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.EmailVerificationTokenUsedError);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.emailVerifiedAt).not.toBeNull();
    expect(updated.email).toBe("racer@example.com");
  });

  it("two different users' change-email tokens racing for the same newEmail apply to exactly one account", async () => {
    const userA = await createUser("a@example.com");
    const userB = await createUser("b@example.com");
    // Bypass createEmailChangeToken's own up-front uniqueness check (it
    // would legitimately reject the second call) to exercise the DB-level
    // backstop this task's doc comment describes — two tokens that were
    // both validly issued before either committed.
    const tokenA = "raw-token-a";
    const tokenB = "raw-token-b";
    await prisma.emailVerificationToken.create({
      data: {
        userId: userA.id,
        tokenHash: db.hashToken(tokenA),
        newEmail: "shared@example.com",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.emailVerificationToken.create({
      data: {
        userId: userB.id,
        tokenHash: db.hashToken(tokenB),
        newEmail: "shared@example.com",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const results = await Promise.allSettled([db.verifyEmail(prisma, tokenA), db.verifyEmail(prisma, tokenB)]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.EmailAlreadyRegisteredError);

    const withSharedEmail = await prisma.user.findMany({ where: { email: "shared@example.com" } });
    expect(withSharedEmail).toHaveLength(1);

    // The loser's token must be rolled back to unused along with the
    // failed User.email update — it must not be left "used" with no email
    // change behind it.
    const tokens = await prisma.emailVerificationToken.findMany({ where: { newEmail: "shared@example.com" } });
    const usedCount = tokens.filter((t) => t.usedAt !== null).length;
    expect(usedCount).toBe(1);
  });
});
