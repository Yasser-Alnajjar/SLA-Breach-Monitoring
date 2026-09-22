/**
 * `GET/POST /api/invitations/accept` (roadmap 5.2): the public accept
 * endpoint — no session, the token is the credential. Pattern A, fully
 * mocked (`@sla/db`'s `previewInvitation`/`acceptInvitation`, `bcryptjs`).
 * Error classes kept real via `importActual` so the route's own
 * `instanceof` branches are genuinely exercised. The real-database,
 * genuinely-concurrent single-use/race-safety proof lives in
 * `invitation-accept-race.test.ts` instead — a mock can't demonstrate that
 * two requests actually race at the database level.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  previewInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}));
const bcrypt = vi.hoisted(() => ({ hash: vi.fn(async () => "hashed-password") }));

vi.mock("@sla/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sla/db")>();
  return {
    ...actual,
    getPrismaClient: vi.fn(() => ({})),
    previewInvitation: db.previewInvitation,
    acceptInvitation: db.acceptInvitation,
  };
});
vi.mock("bcryptjs", () => ({ default: { hash: bcrypt.hash } }));

beforeEach(() => {
  vi.resetModules();
  db.previewInvitation.mockReset();
  db.acceptInvitation.mockReset();
  bcrypt.hash.mockClear();
});

describe("GET /api/invitations/accept", () => {
  it("returns 400 when the token query param is missing", async () => {
    const { GET } = await import("../src/app/api/invitations/accept/route");
    const response = await GET(new Request("http://localhost/api/invitations/accept"));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the token doesn't resolve to any invitation", async () => {
    db.previewInvitation.mockResolvedValue(null);
    const { GET } = await import("../src/app/api/invitations/accept/route");
    const response = await GET(new Request("http://localhost/api/invitations/accept?token=nope"));
    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired invitation", async () => {
    const { InvitationExpiredError } = await import("@sla/db");
    db.previewInvitation.mockRejectedValue(new InvitationExpiredError());
    const { GET } = await import("../src/app/api/invitations/accept/route");
    const response = await GET(new Request("http://localhost/api/invitations/accept?token=t"));
    expect(response.status).toBe(410);
  });

  it("returns 410 for an already-resolved (accepted/revoked) invitation", async () => {
    const { InvitationNotPendingError } = await import("@sla/db");
    db.previewInvitation.mockRejectedValue(new InvitationNotPendingError());
    const { GET } = await import("../src/app/api/invitations/accept/route");
    const response = await GET(new Request("http://localhost/api/invitations/accept?token=t"));
    expect(response.status).toBe(410);
  });

  it("returns the preview (org name, email, alreadyRegistered) for a valid token", async () => {
    db.previewInvitation.mockResolvedValue({ organizationName: "Acme", email: "a@x.com", alreadyRegistered: false });
    const { GET } = await import("../src/app/api/invitations/accept/route");
    const response = await GET(new Request("http://localhost/api/invitations/accept?token=t"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ organizationName: "Acme", email: "a@x.com", alreadyRegistered: false });
  });
});

describe("POST /api/invitations/accept", () => {
  function postRequest(body: unknown) {
    return new Request("http://localhost/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("rejects a short password with 400 and never calls acceptInvitation", async () => {
    const { POST } = await import("../src/app/api/invitations/accept/route");
    const response = await POST(postRequest({ token: "t", name: "Alice", password: "short" }));
    expect(response.status).toBe(400);
    expect(db.acceptInvitation).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown token", async () => {
    const { InvitationNotFoundError } = await import("@sla/db");
    db.acceptInvitation.mockRejectedValue(new InvitationNotFoundError());
    const { POST } = await import("../src/app/api/invitations/accept/route");
    const response = await POST(postRequest({ token: "t", name: "Alice", password: "password123" }));
    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired or already-resolved invitation", async () => {
    const { InvitationNotPendingError } = await import("@sla/db");
    db.acceptInvitation.mockRejectedValue(new InvitationNotPendingError());
    const { POST } = await import("../src/app/api/invitations/accept/route");
    const response = await POST(postRequest({ token: "t", name: "Alice", password: "password123" }));
    expect(response.status).toBe(410);
  });

  it("returns 409 with a sign-in hint when the email is already registered", async () => {
    const { EmailAlreadyRegisteredError } = await import("@sla/db");
    db.acceptInvitation.mockRejectedValue(new EmailAlreadyRegisteredError("a@x.com"));
    const { POST } = await import("../src/app/api/invitations/accept/route");
    const response = await POST(postRequest({ token: "t", name: "Alice", password: "password123" }));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toMatch(/sign in/i);
  });

  it("hashes the password (bcrypt, cost 12) before calling acceptInvitation, and never forwards the raw password", async () => {
    db.acceptInvitation.mockResolvedValue({ userId: "u1", organizationId: "org-a", email: "a@x.com" });
    const { POST } = await import("../src/app/api/invitations/accept/route");
    await POST(postRequest({ token: "t", name: "Alice", password: "password123" }));

    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
    expect(db.acceptInvitation).toHaveBeenCalledWith(expect.anything(), {
      token: "t",
      name: "Alice",
      passwordHash: "hashed-password",
    });
  });

  it("returns ok:true and the created email on success", async () => {
    db.acceptInvitation.mockResolvedValue({ userId: "u1", organizationId: "org-a", email: "a@x.com" });
    const { POST } = await import("../src/app/api/invitations/accept/route");
    const response = await POST(postRequest({ token: "t", name: "Alice", password: "password123" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, email: "a@x.com" });
  });
});
