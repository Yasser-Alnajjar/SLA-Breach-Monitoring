/**
 * `acceptInvitation` (roadmap 5.2, guardrail: single-use and race-safe):
 * proves the atomicity claim for real, against a real Postgres — a mock
 * can't demonstrate two requests genuinely racing at the database level.
 * Two shapes of race:
 *   1. The same token, accepted twice concurrently (double-submit / a
 *      retried request) — only one `User` may ever be created.
 *   2. Two different pending invitations that happen to share an email
 *      (possible since the partial-unique-pending constraint is scoped per
 *      organization, not globally), accepted concurrently — `User.email`'s
 *      own unique constraint is the final backstop; only one wins.
 *
 * Real Postgres, same shape as organization-lock.test.ts. Needs a migrated
 * database at TEST_DATABASE_URL whose name contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("acceptInvitation (real Postgres, race safety)", () => {
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

  async function createOrgWithOwner(name: string) {
    return prisma.organization.create({
      data: { name, users: { create: { email: `owner-${name.toLowerCase()}@x.com`, passwordHash: "x", role: "owner" } } },
      include: { users: true },
    });
  }

  it("the same token accepted twice concurrently creates exactly one User; the loser gets InvitationNotPendingError", async () => {
    const org = await createOrgWithOwner("RaceOrg1");
    const { token } = await db.createOrResendInvitation(prisma, {
      organizationId: org.id,
      invitedByUserId: org.users[0]!.id,
      email: "invitee@example.com",
    });

    const results = await Promise.allSettled([
      db.acceptInvitation(prisma, { token, name: "Invitee A", passwordHash: "h1" }),
      db.acceptInvitation(prisma, { token, name: "Invitee B", passwordHash: "h2" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.InvitationNotPendingError);

    const users = await prisma.user.findMany({ where: { email: "invitee@example.com" } });
    expect(users).toHaveLength(1);

    const invitation = await prisma.organizationInvitation.findFirst({ where: { organizationId: org.id, email: "invitee@example.com" } });
    expect(invitation?.status).toBe("accepted");
    expect(invitation?.acceptedByUserId).toBe(users[0]!.id);
  });

  it("two different pending invitations (different orgs) sharing an email, accepted concurrently, still create exactly one User", async () => {
    const orgA = await createOrgWithOwner("RaceOrgA");
    const orgB = await createOrgWithOwner("RaceOrgB");

    const invA = await db.createOrResendInvitation(prisma, {
      organizationId: orgA.id,
      invitedByUserId: orgA.users[0]!.id,
      email: "shared@example.com",
    });
    const invB = await db.createOrResendInvitation(prisma, {
      organizationId: orgB.id,
      invitedByUserId: orgB.users[0]!.id,
      email: "shared@example.com",
    });

    const results = await Promise.allSettled([
      db.acceptInvitation(prisma, { token: invA.token, name: "A", passwordHash: "h1" }),
      db.acceptInvitation(prisma, { token: invB.token, name: "B", passwordHash: "h2" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.EmailAlreadyRegisteredError);

    const users = await prisma.user.findMany({ where: { email: "shared@example.com" } });
    expect(users).toHaveLength(1);

    // The loser's invitation must be rolled back to pending — its claim
    // (the conditional updateMany) was undone along with the failed create,
    // it must not be left "accepted" with no user behind it.
    const invitations = await prisma.organizationInvitation.findMany({
      where: { email: "shared@example.com" },
      orderBy: { organizationId: "asc" },
    });
    const statuses = invitations.map((i) => i.status).sort();
    expect(statuses).toEqual(["accepted", "pending"]);
  });

  it("two concurrent invites for the same (organization, email) create exactly one pending invitation — the loser gets InvitationConflictError", async () => {
    const org = await createOrgWithOwner("ConflictOrg");

    const results = await Promise.allSettled([
      db.createOrResendInvitation(prisma, { organizationId: org.id, invitedByUserId: org.users[0]!.id, email: "dup@example.com" }),
      db.createOrResendInvitation(prisma, { organizationId: org.id, invitedByUserId: org.users[0]!.id, email: "dup@example.com" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(db.InvitationConflictError);

    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: org.id, email: "dup@example.com", status: "pending" },
    });
    expect(invitations).toHaveLength(1);
  });

  it("accepting the same invitation after it was already accepted (a later, separate request) never creates a second User", async () => {
    const org = await createOrgWithOwner("SequentialOrg");
    const { token } = await db.createOrResendInvitation(prisma, {
      organizationId: org.id,
      invitedByUserId: org.users[0]!.id,
      email: "sequential@example.com",
    });

    await db.acceptInvitation(prisma, { token, name: "First", passwordHash: "h1" });
    await expect(db.acceptInvitation(prisma, { token, name: "Second", passwordHash: "h2" })).rejects.toBeInstanceOf(
      db.InvitationNotPendingError,
    );

    const users = await prisma.user.findMany({ where: { email: "sequential@example.com" } });
    expect(users).toHaveLength(1);
    expect(users[0]!.name).toBe("First");
  });
});
