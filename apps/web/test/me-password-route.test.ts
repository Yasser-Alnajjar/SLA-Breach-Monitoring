/**
 * `POST /api/me/password` (change password) — no prior coverage existed.
 * Added alongside roadmap 5.7 to also cover the new `sessionVersion`
 * increment (signs out every live session for the account, including the
 * caller's own — see `auth.ts`'s `jwt` callback). Pattern A, fully mocked
 * (`next-auth`, `@/lib/auth`, `@sla/db`, `bcryptjs`).
 */
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: null as Session | null }));
const db = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
const bcrypt = vi.hoisted(() => ({ compare: vi.fn(), hash: vi.fn(async () => "new-hash") }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => auth.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sla/db", () => ({
  getPrismaClient: vi.fn(() => ({ user: { findUnique: db.findUnique, update: db.update } })),
}));
vi.mock("bcryptjs", () => ({ default: { compare: bcrypt.compare, hash: bcrypt.hash } }));

function sessionFor(userId = "user-1"): Session {
  return {
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: {
      id: userId,
      organizationId: "org-1",
      email: "a@x.com",
      emailVerifiedAt: new Date(),
      name: null,
      image: null,
      role: "owner",
      createdAt: new Date(),
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  auth.session = null;
  db.findUnique.mockReset();
  db.update.mockReset();
  bcrypt.compare.mockReset();
  bcrypt.hash.mockClear();
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/me/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/password", () => {
  it("returns 401 when signed out", async () => {
    const { POST } = await import("../src/app/api/me/password/route");
    const response = await POST(postRequest({ currentPassword: "x", newPassword: "newpassword1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a new password shorter than 8 characters", async () => {
    auth.session = sessionFor();
    const { POST } = await import("../src/app/api/me/password/route");
    const response = await POST(postRequest({ currentPassword: "x", newPassword: "short" }));
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an incorrect current password, without updating anything", async () => {
    auth.session = sessionFor();
    db.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "old-hash" });
    bcrypt.compare.mockResolvedValue(false);
    const { POST } = await import("../src/app/api/me/password/route");
    const response = await POST(postRequest({ currentPassword: "wrong", newPassword: "newpassword1" }));
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates the password hash and increments sessionVersion on success", async () => {
    auth.session = sessionFor();
    db.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "old-hash" });
    bcrypt.compare.mockResolvedValue(true);
    db.update.mockResolvedValue({});
    const { POST } = await import("../src/app/api/me/password/route");
    const response = await POST(postRequest({ currentPassword: "correct", newPassword: "newpassword1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
  });
});
