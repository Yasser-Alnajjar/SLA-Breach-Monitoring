/**
 * `GET /api/settings/members` and `PATCH/DELETE /api/settings/members/[id]`
 * (roadmap 5.3): session-gated member management, same pattern as every
 * other settings route (Pattern A, fully mocked `@sla/db` domain functions
 * and `next-auth`/`@/lib/auth`). The error *classes* are kept real via
 * `importActual` so the routes' own `instanceof` checks exercise real
 * behavior, not a mock's identity.
 */
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: null as Session | null }));
const db = vi.hoisted(() => ({
  listMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => auth.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sla/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sla/db")>();
  return {
    ...actual,
    getPrismaClient: vi.fn(() => ({})),
    listMembers: db.listMembers,
    updateMemberRole: db.updateMemberRole,
    removeMember: db.removeMember,
  };
});

function sessionFor(organizationId: string, userId = "user-1", role: "owner" | "member" = "owner"): Session {
  return {
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: userId, organizationId, email: "owner@tenant.test", emailVerifiedAt: new Date(), name: null, image: null, role, createdAt: new Date() },
  };
}

beforeEach(() => {
  vi.resetModules();
  db.listMembers.mockReset();
  db.updateMemberRole.mockReset();
  db.removeMember.mockReset();
  auth.session = null;
});

describe("GET /api/settings/members", () => {
  it("rejects a signed-out request with 401", async () => {
    const { GET } = await import("../src/app/api/settings/members/route");
    const response = await GET();
    expect(response.status).toBe(401);
    expect(db.listMembers).not.toHaveBeenCalled();
  });

  it("returns the caller's own organization's members", async () => {
    auth.session = sessionFor("org-a");
    db.listMembers.mockResolvedValue([
      { id: "u1", email: "owner@tenant.test", name: "Owner", role: "owner", createdAt: new Date("2026-09-01T00:00:00Z") },
    ]);

    const { GET } = await import("../src/app/api/settings/members/route");
    const response = await GET();
    const body = await response.json();

    expect(db.listMembers).toHaveBeenCalledWith(expect.anything(), "org-a");
    expect(body.members).toEqual([
      { id: "u1", email: "owner@tenant.test", name: "Owner", role: "owner", createdAt: "2026-09-01T00:00:00.000Z" },
    ]);
  });
});

describe("PATCH /api/settings/members/[id]", () => {
  function patchRequest(body: unknown) {
    return new Request("http://localhost/api/settings/members/u2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects a signed-out request with 401", async () => {
    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "owner" }), { params: Promise.resolve({ id: "u2" }) });
    expect(response.status).toBe(401);
    expect(db.updateMemberRole).not.toHaveBeenCalled();
  });

  it("rejects a member's request to change a role with 403", async () => {
    auth.session = sessionFor("org-a", "user-1", "member");
    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "owner" }), { params: Promise.resolve({ id: "u2" }) });
    expect(response.status).toBe(403);
    expect(db.updateMemberRole).not.toHaveBeenCalled();
  });

  it("rejects an invalid role with 400", async () => {
    auth.session = sessionFor("org-a");
    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "admin" }), { params: Promise.resolve({ id: "u2" }) });
    expect(response.status).toBe(400);
    expect(db.updateMemberRole).not.toHaveBeenCalled();
  });

  it("scopes the role update to the caller's own organization", async () => {
    auth.session = sessionFor("org-a");
    db.updateMemberRole.mockResolvedValue(undefined);

    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "owner" }), { params: Promise.resolve({ id: "u2" }) });

    expect(response.status).toBe(200);
    expect(db.updateMemberRole).toHaveBeenCalledWith(expect.anything(), {
      organizationId: "org-a",
      memberId: "u2",
      role: "owner",
    });
  });

  it("returns 404 when the target member doesn't exist in this organization", async () => {
    auth.session = sessionFor("org-a");
    const { MemberNotFoundError } = await import("@sla/db");
    db.updateMemberRole.mockRejectedValue(new MemberNotFoundError());

    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "member" }), { params: Promise.resolve({ id: "u2" }) });

    expect(response.status).toBe(404);
  });

  it("returns 409 when demoting the organization's only owner", async () => {
    auth.session = sessionFor("org-a");
    const { LastOwnerError } = await import("@sla/db");
    db.updateMemberRole.mockRejectedValue(new LastOwnerError());

    const { PATCH } = await import("../src/app/api/settings/members/[id]/route");
    const response = await PATCH(patchRequest({ role: "member" }), { params: Promise.resolve({ id: "u1" }) });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/settings/members/[id]", () => {
  function deleteRequest() {
    return new Request("http://localhost/api/settings/members/u2", { method: "DELETE" });
  }

  it("rejects a signed-out request with 401", async () => {
    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "u2" }) });
    expect(response.status).toBe(401);
    expect(db.removeMember).not.toHaveBeenCalled();
  });

  it("rejects a member's request to remove another member with 403", async () => {
    auth.session = sessionFor("org-a", "user-1", "member");
    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "u2" }) });
    expect(response.status).toBe(403);
    expect(db.removeMember).not.toHaveBeenCalled();
  });

  it("removes a member scoped to the caller's own organization", async () => {
    auth.session = sessionFor("org-a", "user-1");
    db.removeMember.mockResolvedValue(undefined);

    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "u2" }) });

    expect(response.status).toBe(200);
    expect(db.removeMember).toHaveBeenCalledWith(expect.anything(), {
      organizationId: "org-a",
      memberId: "u2",
      actingUserId: "user-1",
    });
  });

  it("returns 400 when the caller tries to remove themselves", async () => {
    auth.session = sessionFor("org-a", "user-1");
    const { CannotRemoveSelfError } = await import("@sla/db");
    db.removeMember.mockRejectedValue(new CannotRemoveSelfError());

    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/settings/members/user-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the target member doesn't exist in this organization", async () => {
    auth.session = sessionFor("org-a");
    const { MemberNotFoundError } = await import("@sla/db");
    db.removeMember.mockRejectedValue(new MemberNotFoundError());

    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "u2" }) });

    expect(response.status).toBe(404);
  });

  it("returns 409 when removing the organization's only owner", async () => {
    auth.session = sessionFor("org-a");
    const { LastOwnerError } = await import("@sla/db");
    db.removeMember.mockRejectedValue(new LastOwnerError());

    const { DELETE } = await import("../src/app/api/settings/members/[id]/route");
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "u2" }) });

    expect(response.status).toBe(409);
  });
});
