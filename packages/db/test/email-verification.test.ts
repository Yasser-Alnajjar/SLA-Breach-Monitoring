import { describe, expect, it } from "vitest";
import { hashToken } from "../src/secure-token";
import { EmailAlreadyRegisteredError } from "../src/invitations";
import {
  EmailVerificationTokenExpiredError,
  EmailVerificationTokenNotFoundError,
  EmailVerificationTokenUsedError,
  createEmailChangeToken,
  createEmailVerificationToken,
  verifyEmail,
} from "../src/email-verification";

interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  newEmail: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}

/** In-memory stand-in for the Prisma delegates `email-verification.ts` touches — same shape as `password-reset.test.ts`'s `fakePrisma`. */
function fakePrisma(opts: { users?: UserRow[]; tokens?: TokenRow[] }) {
  let users = opts.users ?? [];
  let tokens = opts.tokens ?? [];
  let nextId = 1;

  function uniqueConstraintError(): Error {
    return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  }

  function makeDelegates(
    getTokens: () => TokenRow[],
    setTokens: (rows: TokenRow[]) => void,
    getUsers: () => UserRow[],
    setUsers: (rows: UserRow[]) => void,
  ) {
    return {
      user: {
        findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
          getUsers().find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
          const current = getUsers();
          const idx = current.findIndex((u) => u.id === where.id);
          if (idx === -1) throw new Error("not found");
          if (data.email !== undefined && current.some((u) => u.id !== where.id && u.email === data.email)) {
            throw uniqueConstraintError();
          }
          const updated = { ...current[idx]!, ...data };
          const next = [...current];
          next[idx] = updated;
          setUsers(next);
          return updated;
        },
      },
      emailVerificationToken: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          getTokens().find((t) => t.tokenHash === where.tokenHash) ?? null,
        create: async ({ data }: { data: Omit<TokenRow, "id" | "usedAt" | "createdAt"> }) => {
          const row: TokenRow = { id: `tok_${nextId++}`, usedAt: null, createdAt: new Date(), ...data };
          setTokens([...getTokens(), row]);
          return row;
        },
        deleteMany: async ({
          where,
        }: {
          where: { userId: string; usedAt: null; newEmail: null | { not: null } };
        }) => {
          const matchesNewEmail = (row: TokenRow) =>
            where.newEmail === null ? row.newEmail === null : row.newEmail !== null;
          const before = getTokens().length;
          setTokens(
            getTokens().filter((t) => !(t.userId === where.userId && t.usedAt === where.usedAt && matchesNewEmail(t))),
          );
          return { count: before - getTokens().length };
        },
        updateMany: async ({ where, data }: { where: { id: string; usedAt: null }; data: Partial<TokenRow> }) => {
          const current = getTokens();
          const idx = current.findIndex((t) => t.id === where.id && t.usedAt === where.usedAt);
          if (idx === -1) return { count: 0 };
          const next = [...current];
          next[idx] = { ...next[idx]!, ...data };
          setTokens(next);
          return { count: 1 };
        },
      },
    };
  }

  const prisma = {
    ...makeDelegates(
      () => tokens,
      (rows) => (tokens = rows),
      () => users,
      (rows) => (users = rows),
    ),
    $transaction: async <T>(callback: (tx: ReturnType<typeof makeDelegates>) => Promise<T>): Promise<T> => {
      const tokensSnapshot = tokens;
      const usersSnapshot = users;
      const tx = makeDelegates(
        () => tokens,
        (rows) => (tokens = rows),
        () => users,
        (rows) => (users = rows),
      );
      try {
        return await callback(tx);
      } catch (error) {
        tokens = tokensSnapshot;
        users = usersSnapshot;
        throw error;
      }
    },
  };

  return {
    prisma: prisma as unknown as import("../generated/prisma/client").PrismaClient,
    tokens: () => tokens,
    users: () => users,
  };
}

const USER: UserRow = { id: "user_1", email: "a@x.com", emailVerifiedAt: null };
const OTHER: UserRow = { id: "user_2", email: "taken@x.com", emailVerifiedAt: new Date() };

describe("createEmailVerificationToken", () => {
  it("creates a token with newEmail null and returns the raw token, never the hash", async () => {
    const fake = fakePrisma({ users: [USER] });
    const result = await createEmailVerificationToken(fake.prisma, USER.id);
    expect(fake.tokens()).toHaveLength(1);
    expect(fake.tokens()[0]!.newEmail).toBeNull();
    expect(fake.tokens()[0]!.tokenHash).toBe(hashToken(result.token));
  });

  it("deletes a prior unused signup-verification token before issuing a new one, leaving a pending change token alone", async () => {
    const oldVerify: TokenRow = {
      id: "tok_old_verify",
      userId: USER.id,
      tokenHash: "h1",
      newEmail: null,
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      createdAt: new Date(),
    };
    const pendingChange: TokenRow = {
      id: "tok_change",
      userId: USER.id,
      tokenHash: "h2",
      newEmail: "new@x.com",
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      createdAt: new Date(),
    };
    const fake = fakePrisma({ users: [USER], tokens: [oldVerify, pendingChange] });
    await createEmailVerificationToken(fake.prisma, USER.id);
    const remaining = fake.tokens();
    expect(remaining.some((t) => t.id === "tok_old_verify")).toBe(false);
    expect(remaining.some((t) => t.id === "tok_change")).toBe(true);
  });
});

describe("createEmailChangeToken", () => {
  it("throws EmailAlreadyRegisteredError when newEmail belongs to another user", async () => {
    const fake = fakePrisma({ users: [USER, OTHER] });
    await expect(
      createEmailChangeToken(fake.prisma, { userId: USER.id, newEmail: OTHER.email }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(fake.tokens()).toHaveLength(0);
  });

  it("creates a token carrying the normalized newEmail", async () => {
    const fake = fakePrisma({ users: [USER] });
    await createEmailChangeToken(fake.prisma, { userId: USER.id, newEmail: "  New@X.com  " });
    expect(fake.tokens()[0]!.newEmail).toBe("new@x.com");
  });

  it("deletes a prior unused change token before issuing a new one, leaving a pending signup-verification token alone", async () => {
    const oldChange: TokenRow = {
      id: "tok_old_change",
      userId: USER.id,
      tokenHash: "h1",
      newEmail: "old-new@x.com",
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      createdAt: new Date(),
    };
    const pendingVerify: TokenRow = {
      id: "tok_verify",
      userId: USER.id,
      tokenHash: "h2",
      newEmail: null,
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      createdAt: new Date(),
    };
    const fake = fakePrisma({ users: [USER], tokens: [oldChange, pendingVerify] });
    await createEmailChangeToken(fake.prisma, { userId: USER.id, newEmail: "brand-new@x.com" });
    const remaining = fake.tokens();
    expect(remaining.some((t) => t.id === "tok_old_change")).toBe(false);
    expect(remaining.some((t) => t.id === "tok_verify")).toBe(true);
  });
});

describe("verifyEmail", () => {
  function verifyToken(overrides: Partial<TokenRow> = {}): TokenRow {
    return {
      id: "tok_1",
      userId: USER.id,
      tokenHash: hashToken("raw-token"),
      newEmail: null,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("throws EmailVerificationTokenNotFoundError for an unknown token", async () => {
    const fake = fakePrisma({ users: [USER] });
    await expect(verifyEmail(fake.prisma, "nope")).rejects.toBeInstanceOf(EmailVerificationTokenNotFoundError);
  });

  it("throws EmailVerificationTokenExpiredError for an expired token", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [verifyToken({ expiresAt: new Date(Date.now() - 1000) })] });
    await expect(verifyEmail(fake.prisma, "raw-token")).rejects.toBeInstanceOf(EmailVerificationTokenExpiredError);
  });

  it("throws EmailVerificationTokenUsedError for an already-used token", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [verifyToken({ usedAt: new Date() })] });
    await expect(verifyEmail(fake.prisma, "raw-token")).rejects.toBeInstanceOf(EmailVerificationTokenUsedError);
  });

  it("marks the current email verified when newEmail is null, without changing the address", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [verifyToken()] });
    const result = await verifyEmail(fake.prisma, "raw-token");
    expect(result).toEqual({ userId: USER.id, email: USER.email });
    expect(fake.users()[0]!.emailVerifiedAt).not.toBeNull();
    expect(fake.users()[0]!.email).toBe(USER.email);
  });

  it("moves User.email to newEmail and marks it verified when the token carries a change", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [verifyToken({ newEmail: "new@x.com" })] });
    const result = await verifyEmail(fake.prisma, "raw-token");
    expect(result).toEqual({ userId: USER.id, email: "new@x.com" });
    expect(fake.users()[0]!.email).toBe("new@x.com");
    expect(fake.users()[0]!.emailVerifiedAt).not.toBeNull();
  });

  it("throws EmailAlreadyRegisteredError, and rolls back the claim, if newEmail was registered by someone else before this token was consumed", async () => {
    const fake = fakePrisma({
      users: [USER, OTHER],
      tokens: [verifyToken({ newEmail: OTHER.email })],
    });
    await expect(verifyEmail(fake.prisma, "raw-token")).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(fake.tokens()[0]!.usedAt).toBeNull();
    expect(fake.users()[0]!.email).toBe(USER.email);
  });

  it("a second verification attempt with the same token fails once it's been consumed", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [verifyToken()] });
    await verifyEmail(fake.prisma, "raw-token");
    await expect(verifyEmail(fake.prisma, "raw-token")).rejects.toBeInstanceOf(EmailVerificationTokenUsedError);
  });
});
