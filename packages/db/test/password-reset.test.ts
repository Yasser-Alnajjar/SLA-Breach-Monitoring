import { describe, expect, it } from "vitest";
import { hashToken } from "../src/secure-token";
import {
  PasswordResetTokenExpiredError,
  PasswordResetTokenNotFoundError,
  PasswordResetTokenUsedError,
  requestPasswordReset,
  resetPassword,
} from "../src/password-reset";

interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  sessionVersion: number;
}

/**
 * In-memory stand-in for the Prisma delegates `password-reset.ts` touches —
 * same shape as `invitations.test.ts`'s `fakePrisma`, including
 * snapshot/restore around `$transaction`'s interactive form.
 */
function fakePrisma(opts: { users?: UserRow[]; tokens?: TokenRow[] }) {
  let users = opts.users ?? [];
  let tokens = opts.tokens ?? [];
  let nextId = 1;

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
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<UserRow> & { sessionVersion?: number | { increment: number } };
        }) => {
          const current = getUsers();
          const idx = current.findIndex((u) => u.id === where.id);
          if (idx === -1) throw new Error("not found");
          const sessionVersion =
            typeof data.sessionVersion === "object"
              ? current[idx]!.sessionVersion + data.sessionVersion.increment
              : (data.sessionVersion ?? current[idx]!.sessionVersion);
          const updated = { ...current[idx]!, ...data, sessionVersion };
          const next = [...current];
          next[idx] = updated;
          setUsers(next);
          return updated;
        },
      },
      passwordResetToken: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          getTokens().find((t) => t.tokenHash === where.tokenHash) ?? null,
        create: async ({ data }: { data: Omit<TokenRow, "id" | "usedAt" | "createdAt"> }) => {
          const row: TokenRow = { id: `tok_${nextId++}`, usedAt: null, createdAt: new Date(), ...data };
          setTokens([...getTokens(), row]);
          return row;
        },
        deleteMany: async ({ where }: { where: { userId: string; usedAt: null } }) => {
          const before = getTokens().length;
          setTokens(getTokens().filter((t) => !(t.userId === where.userId && t.usedAt === where.usedAt)));
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

const USER: UserRow = { id: "user_1", email: "a@x.com", passwordHash: "old-hash", sessionVersion: 0 };

describe("requestPasswordReset", () => {
  it("returns null for an email with no account, without creating a token", async () => {
    const fake = fakePrisma({ users: [USER] });
    const result = await requestPasswordReset(fake.prisma, "nobody@x.com");
    expect(result).toBeNull();
    expect(fake.tokens()).toHaveLength(0);
  });

  it("normalizes the email before lookup", async () => {
    const fake = fakePrisma({ users: [USER] });
    const result = await requestPasswordReset(fake.prisma, "  A@X.com  ");
    expect(result?.userId).toBe(USER.id);
  });

  it("creates a token for an existing user and returns the raw token, never the hash", async () => {
    const fake = fakePrisma({ users: [USER] });
    const result = await requestPasswordReset(fake.prisma, USER.email);
    expect(result).not.toBeNull();
    expect(fake.tokens()).toHaveLength(1);
    expect(fake.tokens()[0]!.tokenHash).toBe(hashToken(result!.token));
    expect(fake.tokens()[0]!.tokenHash).not.toBe(result!.token);
  });

  it("deletes any prior unused token for the user before issuing a new one", async () => {
    const existing: TokenRow = {
      id: "tok_old",
      userId: USER.id,
      tokenHash: "old-hash",
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
      createdAt: new Date(),
    };
    const fake = fakePrisma({ users: [USER], tokens: [existing] });
    await requestPasswordReset(fake.prisma, USER.email);
    expect(fake.tokens()).toHaveLength(1);
    expect(fake.tokens()[0]!.id).not.toBe("tok_old");
  });

  it("leaves an already-used token for the same user untouched", async () => {
    const used: TokenRow = {
      id: "tok_used",
      userId: USER.id,
      tokenHash: "used-hash",
      expiresAt: new Date(Date.now() + 1000),
      usedAt: new Date(),
      createdAt: new Date(),
    };
    const fake = fakePrisma({ users: [USER], tokens: [used] });
    await requestPasswordReset(fake.prisma, USER.email);
    expect(fake.tokens()).toHaveLength(2);
    expect(fake.tokens().some((t) => t.id === "tok_used")).toBe(true);
  });
});

describe("resetPassword", () => {
  function pendingToken(overrides: Partial<TokenRow> = {}): TokenRow {
    return {
      id: "tok_1",
      userId: USER.id,
      tokenHash: hashToken("raw-token"),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("throws PasswordResetTokenNotFoundError for an unknown token", async () => {
    const fake = fakePrisma({ users: [USER] });
    await expect(resetPassword(fake.prisma, { token: "nope", passwordHash: "new-hash" })).rejects.toBeInstanceOf(
      PasswordResetTokenNotFoundError,
    );
  });

  it("throws PasswordResetTokenExpiredError for an expired token, and never updates the password", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [pendingToken({ expiresAt: new Date(Date.now() - 1000) })] });
    await expect(
      resetPassword(fake.prisma, { token: "raw-token", passwordHash: "new-hash" }),
    ).rejects.toBeInstanceOf(PasswordResetTokenExpiredError);
    expect(fake.users()[0]!.passwordHash).toBe("old-hash");
  });

  it("throws PasswordResetTokenUsedError for an already-used token", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [pendingToken({ usedAt: new Date() })] });
    await expect(
      resetPassword(fake.prisma, { token: "raw-token", passwordHash: "new-hash" }),
    ).rejects.toBeInstanceOf(PasswordResetTokenUsedError);
  });

  it("marks the token used and updates the user's password together", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [pendingToken()] });
    const result = await resetPassword(fake.prisma, { token: "raw-token", passwordHash: "new-hash" });
    expect(result.userId).toBe(USER.id);
    expect(fake.users()[0]!.passwordHash).toBe("new-hash");
    expect(fake.tokens()[0]!.usedAt).not.toBeNull();
  });

  it("increments sessionVersion, signing out every live session for the account (roadmap 5.7)", async () => {
    const fake = fakePrisma({ users: [{ ...USER, sessionVersion: 3 }], tokens: [pendingToken()] });
    await resetPassword(fake.prisma, { token: "raw-token", passwordHash: "new-hash" });
    expect(fake.users()[0]!.sessionVersion).toBe(4);
  });

  it("a second reset attempt with the same token fails once it's been consumed", async () => {
    const fake = fakePrisma({ users: [USER], tokens: [pendingToken()] });
    await resetPassword(fake.prisma, { token: "raw-token", passwordHash: "new-hash" });
    await expect(
      resetPassword(fake.prisma, { token: "raw-token", passwordHash: "another-hash" }),
    ).rejects.toBeInstanceOf(PasswordResetTokenUsedError);
    expect(fake.users()[0]!.passwordHash).toBe("new-hash");
  });
});
