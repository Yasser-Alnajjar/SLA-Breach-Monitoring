import { describe, expect, it } from "vitest";
import {
  CannotRemoveSelfError,
  LastOwnerError,
  MemberNotFoundError,
  listMembers,
  removeMember,
  updateMemberRole,
} from "../src/members";

interface UserRow {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  role: "owner" | "member";
  createdAt: Date;
}

/** In-memory stand-in for the `user` Prisma delegate — the only one `members.ts` touches. */
function fakePrisma(users: UserRow[]) {
  let rows = users;
  return {
    prisma: {
      user: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          rows.find((u) => u.id === where.id && u.organizationId === where.organizationId) ?? null,
        findMany: async ({ where }: { where: { organizationId: string } }) =>
          rows
            .filter((u) => u.organizationId === where.organizationId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        count: async ({ where }: { where: { organizationId: string; role: string } }) =>
          rows.filter((u) => u.organizationId === where.organizationId && u.role === where.role).length,
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; organizationId: string };
          data: { role: "owner" | "member" };
        }) => {
          const matches = rows.filter((u) => u.id === where.id && u.organizationId === where.organizationId);
          rows = rows.map((u) => (u.id === where.id && u.organizationId === where.organizationId ? { ...u, ...data } : u));
          return { count: matches.length };
        },
        deleteMany: async ({ where }: { where: { id: string; organizationId: string } }) => {
          const matches = rows.filter((u) => u.id === where.id && u.organizationId === where.organizationId);
          rows = rows.filter((u) => !(u.id === where.id && u.organizationId === where.organizationId));
          return { count: matches.length };
        },
      },
    } as unknown as import("../generated/prisma/client").PrismaClient,
    rows: () => rows,
  };
}

function user(overrides: Partial<UserRow> & Pick<UserRow, "id" | "role">): UserRow {
  return {
    organizationId: "org_a",
    email: `${overrides.id}@example.com`,
    name: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("listMembers", () => {
  it("returns only the organization's own members, oldest first", async () => {
    const { prisma } = fakePrisma([
      user({ id: "u2", role: "member", createdAt: new Date("2026-01-02T00:00:00Z") }),
      user({ id: "u1", role: "owner", createdAt: new Date("2026-01-01T00:00:00Z") }),
      user({ id: "u3", role: "member", organizationId: "org_b" }),
    ]);

    const members = await listMembers(prisma, "org_a");

    expect(members.map((m) => m.id)).toEqual(["u1", "u2"]);
  });
});

describe("updateMemberRole", () => {
  it("throws MemberNotFoundError for a member outside the caller's organization", async () => {
    const { prisma } = fakePrisma([user({ id: "u1", role: "owner", organizationId: "org_b" })]);

    await expect(updateMemberRole(prisma, { organizationId: "org_a", memberId: "u1", role: "member" })).rejects.toThrow(
      MemberNotFoundError,
    );
  });

  it("is a no-op when the requested role matches the member's current role", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" })]);

    await updateMemberRole(prisma, { organizationId: "org_a", memberId: "u1", role: "owner" });

    expect(rows()[0]!.role).toBe("owner");
  });

  it("promotes a member to owner", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "member" })]);

    await updateMemberRole(prisma, { organizationId: "org_a", memberId: "u2", role: "owner" });

    expect(rows().find((u) => u.id === "u2")!.role).toBe("owner");
  });

  it("demotes an owner to member when another owner remains", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "owner" })]);

    await updateMemberRole(prisma, { organizationId: "org_a", memberId: "u1", role: "member" });

    expect(rows().find((u) => u.id === "u1")!.role).toBe("member");
  });

  it("throws LastOwnerError when demoting the organization's only owner", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "member" })]);

    await expect(updateMemberRole(prisma, { organizationId: "org_a", memberId: "u1", role: "member" })).rejects.toThrow(
      LastOwnerError,
    );
    expect(rows().find((u) => u.id === "u1")!.role).toBe("owner");
  });
});

describe("removeMember", () => {
  it("throws CannotRemoveSelfError before touching the database", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "member" })]);

    await expect(
      removeMember(prisma, { organizationId: "org_a", memberId: "u1", actingUserId: "u1" }),
    ).rejects.toThrow(CannotRemoveSelfError);
    expect(rows()).toHaveLength(1);
  });

  it("throws MemberNotFoundError for a member outside the caller's organization", async () => {
    const { prisma } = fakePrisma([user({ id: "u1", role: "member", organizationId: "org_b" })]);

    await expect(
      removeMember(prisma, { organizationId: "org_a", memberId: "u1", actingUserId: "u2" }),
    ).rejects.toThrow(MemberNotFoundError);
  });

  it("throws LastOwnerError when removing the organization's only owner", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "member" })]);

    await expect(
      removeMember(prisma, { organizationId: "org_a", memberId: "u1", actingUserId: "u2" }),
    ).rejects.toThrow(LastOwnerError);
    expect(rows()).toHaveLength(2);
  });

  it("removes a member scoped to the organization when the invariant holds", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "member" })]);

    await removeMember(prisma, { organizationId: "org_a", memberId: "u2", actingUserId: "u1" });

    expect(rows().map((u) => u.id)).toEqual(["u1"]);
  });

  it("removes one of two owners without tripping the last-owner guard", async () => {
    const { prisma, rows } = fakePrisma([user({ id: "u1", role: "owner" }), user({ id: "u2", role: "owner" })]);

    await removeMember(prisma, { organizationId: "org_a", memberId: "u2", actingUserId: "u1" });

    expect(rows().map((u) => u.id)).toEqual(["u1"]);
  });
});
