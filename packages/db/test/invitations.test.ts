import { describe, expect, it } from "vitest";
import { hashToken } from "../src/secure-token";
import {
  acceptInvitation,
  createOrResendInvitation,
  EmailAlreadyRegisteredError,
  InvitationConflictError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationNotPendingError,
  listPendingInvitations,
  normalizeEmail,
  previewInvitation,
  revokeInvitation,
} from "../src/invitations";

type Status = "pending" | "accepted" | "revoked";

interface InvitationRow {
  id: string;
  organizationId: string;
  email: string;
  tokenHash: string;
  status: Status;
  invitedByUserId: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: "owner" | "member";
}

interface OrganizationRow {
  id: string;
  name: string;
}

function uniqueConstraintError(): Error {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

/**
 * In-memory stand-in for the Prisma delegates invitations.ts touches.
 * `$transaction`'s interactive callback runs against the SAME mutable
 * store as everything else (no separate connection to simulate), but
 * snapshots and restores on a thrown error — enough to prove the
 * "both the User and the invitation status change together, or neither
 * does" contract without a real database.
 */
function fakePrisma(opts: {
  invitations?: InvitationRow[];
  users?: UserRow[];
  organizations?: OrganizationRow[];
  /** Injects a failure into the next `user.create` call — used to prove the transaction rolls back the invitation's claim too, not just skips creating the user. */
  userCreateFailsWith?: Error;
  /** Injects a failure into the next `organizationInvitation.create` call — simulates two concurrent `createOrResendInvitation` calls both passing the findFirst check before either commits. */
  invitationCreateFailsWith?: Error;
}) {
  let invitations = opts.invitations ?? [];
  let users = opts.users ?? [];
  const organizations = opts.organizations ?? [{ id: "org_a", name: "Acme" }];
  let nextId = 1;

  function findUser(email: string) {
    return users.find((u) => u.email === email) ?? null;
  }

  function makeDelegates(getInvitations: () => InvitationRow[], setInvitations: (rows: InvitationRow[]) => void, getUsers: () => UserRow[], setUsers: (rows: UserRow[]) => void) {
    return {
      organization: {
        findUnique: async ({ where }: { where: { id: string } }) => organizations.find((o) => o.id === where.id) ?? null,
      },
      user: {
        findUnique: async ({ where }: { where: { email: string } }) => getUsers().find((u) => u.email === where.email) ?? null,
        create: async ({ data }: { data: Omit<UserRow, "id"> }) => {
          if (opts.userCreateFailsWith) throw opts.userCreateFailsWith;
          if (getUsers().some((u) => u.email === data.email)) throw uniqueConstraintError();
          const user: UserRow = { id: `user_${nextId++}`, ...data };
          setUsers([...getUsers(), user]);
          return user;
        },
      },
      organizationInvitation: {
        findFirst: async ({ where }: { where: { organizationId: string; email: string; status: Status } }) =>
          getInvitations().find(
            (i) => i.organizationId === where.organizationId && i.email === where.email && i.status === where.status,
          ) ?? null,
        findUnique: async ({ where }: { where: { tokenHash: string } }) => {
          const row = getInvitations().find((i) => i.tokenHash === where.tokenHash) ?? null;
          if (!row) return null;
          const organization = organizations.find((o) => o.id === row.organizationId) ?? null;
          return { ...row, organization };
        },
        findMany: async ({ where }: { where: { organizationId: string; status: Status } }) =>
          getInvitations()
            .filter((i) => i.organizationId === where.organizationId && i.status === where.status)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        create: async ({ data }: { data: Omit<InvitationRow, "id" | "status" | "acceptedAt" | "acceptedByUserId" | "revokedAt" | "createdAt" | "updatedAt"> }) => {
          if (opts.invitationCreateFailsWith) throw opts.invitationCreateFailsWith;
          if (getInvitations().some((i) => i.organizationId === data.organizationId && i.email === data.email && i.status === "pending")) {
            throw uniqueConstraintError();
          }
          const now = new Date();
          const row: InvitationRow = {
            id: `inv_${nextId++}`,
            status: "pending",
            acceptedAt: null,
            acceptedByUserId: null,
            revokedAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          setInvitations([...getInvitations(), row]);
          return row;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<InvitationRow> }) => {
          const current = getInvitations();
          const idx = current.findIndex((i) => i.id === where.id);
          if (idx === -1) throw new Error("not found");
          const updated = { ...current[idx]!, ...data, updatedAt: new Date() };
          const next = [...current];
          next[idx] = updated;
          setInvitations(next);
          return updated;
        },
        updateMany: async ({ where, data }: { where: { id: string; organizationId?: string; status: Status }; data: Partial<InvitationRow> }) => {
          const current = getInvitations();
          const idx = current.findIndex(
            (i) => i.id === where.id && i.status === where.status && (where.organizationId === undefined || i.organizationId === where.organizationId),
          );
          if (idx === -1) return { count: 0 };
          const next = [...current];
          next[idx] = { ...next[idx]!, ...data, updatedAt: new Date() };
          setInvitations(next);
          return { count: 1 };
        },
      },
    };
  }

  const prisma = {
    ...makeDelegates(
      () => invitations,
      (rows) => (invitations = rows),
      () => users,
      (rows) => (users = rows),
    ),
    $transaction: async <T>(callback: (tx: ReturnType<typeof makeDelegates>) => Promise<T>): Promise<T> => {
      const invitationsSnapshot = invitations;
      const usersSnapshot = users;
      const tx = makeDelegates(
        () => invitations,
        (rows) => (invitations = rows),
        () => users,
        (rows) => (users = rows),
      );
      try {
        return await callback(tx);
      } catch (error) {
        invitations = invitationsSnapshot;
        users = usersSnapshot;
        throw error;
      }
    },
  };

  return { prisma: prisma as unknown as import("../generated/prisma/client").PrismaClient, invitations: () => invitations, users: () => users, findUser };
}

const FUTURE = new Date(Date.now() + 60_000);
const PAST = new Date(Date.now() - 60_000);

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.com  ")).toBe("alice@example.com");
  });
});

describe("createOrResendInvitation", () => {
  it("creates a new pending invitation and returns the raw token, org name, and resent: false", async () => {
    const { prisma, invitations } = fakePrisma({});

    const result = await createOrResendInvitation(prisma, {
      organizationId: "org_a",
      invitedByUserId: "user_owner",
      email: "  Alice@Example.com  ",
    });

    expect(result.resent).toBe(false);
    expect(result.organizationName).toBe("Acme");
    expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(invitations()).toHaveLength(1);
    expect(invitations()[0]).toMatchObject({ email: "alice@example.com", status: "pending" });
    expect(invitations()[0]!.tokenHash).toBe(hashToken(result.token));
  });

  it("rejects when the email already belongs to a User, anywhere", async () => {
    const { prisma } = fakePrisma({
      users: [{ id: "u1", organizationId: "org_other", email: "alice@example.com", passwordHash: "x", name: null, role: "member" }],
    });

    await expect(
      createOrResendInvitation(prisma, { organizationId: "org_a", invitedByUserId: "owner", email: "alice@example.com" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("resending rotates the token and extends expiry on the existing pending row instead of creating a second one", async () => {
    const existing: InvitationRow = {
      id: "inv_1",
      organizationId: "org_a",
      email: "alice@example.com",
      tokenHash: "old-hash",
      status: "pending",
      invitedByUserId: "owner",
      expiresAt: PAST,
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { prisma, invitations } = fakePrisma({ invitations: [existing] });

    const result = await createOrResendInvitation(prisma, {
      organizationId: "org_a",
      invitedByUserId: "owner-2",
      email: "alice@example.com",
    });

    expect(result.resent).toBe(true);
    expect(invitations()).toHaveLength(1);
    expect(invitations()[0]!.id).toBe("inv_1");
    expect(invitations()[0]!.tokenHash).not.toBe("old-hash");
    expect(invitations()[0]!.tokenHash).toBe(hashToken(result.token));
    expect(invitations()[0]!.expiresAt.getTime()).toBeGreaterThan(PAST.getTime());
    expect(invitations()[0]!.invitedByUserId).toBe("owner-2");
  });

  it("does not touch a pending invitation for the same email in a different organization", async () => {
    const otherOrgInvitation: InvitationRow = {
      id: "inv_1",
      organizationId: "org_b",
      email: "alice@example.com",
      tokenHash: "other-org-hash",
      status: "pending",
      invitedByUserId: "owner",
      expiresAt: FUTURE,
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { prisma, invitations } = fakePrisma({
      invitations: [otherOrgInvitation],
      organizations: [{ id: "org_a", name: "Acme" }, { id: "org_b", name: "Other" }],
    });

    await createOrResendInvitation(prisma, { organizationId: "org_a", invitedByUserId: "owner", email: "alice@example.com" });

    expect(invitations()).toHaveLength(2);
    expect(invitations().find((i) => i.id === "inv_1")!.tokenHash).toBe("other-org-hash");
  });

  it("converts a unique-constraint violation on create into InvitationConflictError (two concurrent invites for the same org+email both passing the findFirst check)", async () => {
    const { prisma, invitations } = fakePrisma({ invitationCreateFailsWith: uniqueConstraintError() });

    await expect(
      createOrResendInvitation(prisma, { organizationId: "org_a", invitedByUserId: "owner", email: "alice@example.com" }),
    ).rejects.toBeInstanceOf(InvitationConflictError);
    expect(invitations()).toHaveLength(0);
  });
});

describe("listPendingInvitations / revokeInvitation", () => {
  it("lists only pending invitations for the given organization", async () => {
    const { prisma } = fakePrisma({
      invitations: [
        { id: "1", organizationId: "org_a", email: "a@x.com", tokenHash: "h1", status: "pending", invitedByUserId: "o", expiresAt: FUTURE, acceptedAt: null, acceptedByUserId: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "2", organizationId: "org_a", email: "b@x.com", tokenHash: "h2", status: "accepted", invitedByUserId: "o", expiresAt: FUTURE, acceptedAt: new Date(), acceptedByUserId: "u", revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "3", organizationId: "org_b", email: "c@x.com", tokenHash: "h3", status: "pending", invitedByUserId: "o", expiresAt: FUTURE, acceptedAt: null, acceptedByUserId: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
    });

    const result = await listPendingInvitations(prisma, "org_a");
    expect(result.map((i) => i.id)).toEqual(["1"]);
  });

  it("revoking marks status revoked and is scoped to the organization", async () => {
    const { prisma, invitations } = fakePrisma({
      invitations: [
        { id: "1", organizationId: "org_a", email: "a@x.com", tokenHash: "h1", status: "pending", invitedByUserId: "o", expiresAt: FUTURE, acceptedAt: null, acceptedByUserId: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ],
    });

    await revokeInvitation(prisma, { organizationId: "org_b", invitationId: "1" });
    expect(invitations()[0]!.status).toBe("pending"); // wrong org — no-op

    await revokeInvitation(prisma, { organizationId: "org_a", invitationId: "1" });
    expect(invitations()[0]!.status).toBe("revoked");
    expect(invitations()[0]!.revokedAt).not.toBeNull();
  });
});

describe("previewInvitation", () => {
  function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
    return {
      id: "1",
      organizationId: "org_a",
      email: "alice@example.com",
      tokenHash: hashToken("raw-token"),
      status: "pending",
      invitedByUserId: "owner",
      expiresAt: FUTURE,
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("returns null for an unknown token", async () => {
    const { prisma } = fakePrisma({});
    expect(await previewInvitation(prisma, "no-such-token")).toBeNull();
  });

  it("returns the org name, email, and alreadyRegistered: false for a valid pending invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation()] });
    const result = await previewInvitation(prisma, "raw-token");
    expect(result).toEqual({ organizationName: "Acme", email: "alice@example.com", alreadyRegistered: false });
  });

  it("returns alreadyRegistered: true when the email now belongs to a User", async () => {
    const { prisma } = fakePrisma({
      invitations: [invitation()],
      users: [{ id: "u1", organizationId: "org_x", email: "alice@example.com", passwordHash: "x", name: null, role: "member" }],
    });
    const result = await previewInvitation(prisma, "raw-token");
    expect(result?.alreadyRegistered).toBe(true);
  });

  it("throws InvitationExpiredError for an expired invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation({ expiresAt: PAST })] });
    await expect(previewInvitation(prisma, "raw-token")).rejects.toBeInstanceOf(InvitationExpiredError);
  });

  it("throws InvitationNotPendingError for an already-accepted invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation({ status: "accepted" })] });
    await expect(previewInvitation(prisma, "raw-token")).rejects.toBeInstanceOf(InvitationNotPendingError);
  });

  it("throws InvitationNotPendingError for a revoked invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation({ status: "revoked" })] });
    await expect(previewInvitation(prisma, "raw-token")).rejects.toBeInstanceOf(InvitationNotPendingError);
  });
});

describe("acceptInvitation", () => {
  function invitation(overrides: Partial<InvitationRow> = {}): InvitationRow {
    return {
      id: "1",
      organizationId: "org_a",
      email: "alice@example.com",
      tokenHash: hashToken("raw-token"),
      status: "pending",
      invitedByUserId: "owner",
      expiresAt: FUTURE,
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("throws InvitationNotFoundError for an unknown token", async () => {
    const { prisma } = fakePrisma({});
    await expect(acceptInvitation(prisma, { token: "nope", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      InvitationNotFoundError,
    );
  });

  it("throws InvitationExpiredError for an expired invitation, without creating a User", async () => {
    const { prisma, users } = fakePrisma({ invitations: [invitation({ expiresAt: PAST })] });
    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      InvitationExpiredError,
    );
    expect(users()).toHaveLength(0);
  });

  it("throws InvitationNotPendingError for an already-accepted invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation({ status: "accepted" })] });
    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      InvitationNotPendingError,
    );
  });

  it("throws InvitationNotPendingError for a revoked invitation", async () => {
    const { prisma } = fakePrisma({ invitations: [invitation({ status: "revoked" })] });
    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      InvitationNotPendingError,
    );
  });

  it("throws EmailAlreadyRegisteredError, without creating a second User, when the email is already registered", async () => {
    const { prisma, users } = fakePrisma({
      invitations: [invitation()],
      users: [{ id: "u1", organizationId: "org_x", email: "alice@example.com", passwordHash: "existing", name: null, role: "member" }],
    });

    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
    expect(users()).toHaveLength(1); // still just the pre-existing one
  });

  it("creates the User (role member) and marks the invitation accepted, atomically", async () => {
    const { prisma, invitations, users } = fakePrisma({ invitations: [invitation()] });

    const result = await acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "hashed-pw" });

    expect(result).toEqual({ userId: expect.any(String), organizationId: "org_a", email: "alice@example.com" });
    expect(users()).toHaveLength(1);
    expect(users()[0]).toMatchObject({ organizationId: "org_a", email: "alice@example.com", passwordHash: "hashed-pw", name: "Alice", role: "member" });
    expect(invitations()[0]!.status).toBe("accepted");
    expect(invitations()[0]!.acceptedByUserId).toBe(result.userId);
    expect(invitations()[0]!.acceptedAt).not.toBeNull();
  });

  it("is single-use: a second accept of the same (already-consumed) token fails and does not create a second User", async () => {
    const { prisma, users } = fakePrisma({ invitations: [invitation()] });

    await acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h1" });
    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice Again", passwordHash: "h2" })).rejects.toBeInstanceOf(
      InvitationNotPendingError,
    );
    expect(users()).toHaveLength(1);
  });

  it("rolls back the invitation's claim (back to pending) when User creation fails inside the transaction — the two writes are all-or-nothing", async () => {
    const { prisma, invitations, users } = fakePrisma({
      invitations: [invitation()],
      userCreateFailsWith: new Error("database connection lost"),
    });

    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toThrow(
      "database connection lost",
    );

    expect(users()).toHaveLength(0);
    // Not left "accepted" with no user behind it — the conditional
    // updateMany's effect is rolled back along with the failed create.
    expect(invitations()[0]!.status).toBe("pending");
    expect(invitations()[0]!.acceptedByUserId).toBeNull();
  });

  it("converts a User.email unique-constraint violation raised inside the transaction into EmailAlreadyRegisteredError, and still rolls back", async () => {
    const { prisma, invitations, users } = fakePrisma({
      invitations: [invitation()],
      userCreateFailsWith: uniqueConstraintError(),
    });

    await expect(acceptInvitation(prisma, { token: "raw-token", name: "Alice", passwordHash: "h" })).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );

    expect(users()).toHaveLength(0);
    expect(invitations()[0]!.status).toBe("pending");
  });
});
