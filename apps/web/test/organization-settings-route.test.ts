/**
 * `GET/PATCH /api/settings/organization` (roadmap 5.8): organization name
 * and display timezone. `GET` stays open to any signed-in member (5.4's
 * "read stays open" convention — everyone needs to see the timezone used
 * to group dashboard days); only `PATCH` is owner-gated.
 *
 * Fully mocked (`@sla/db`, `next-auth`, `@/lib/auth`) — no Postgres needed.
 */
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: null as Session | null }));
const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => auth.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sla/db", () => ({
  getPrismaClient: vi.fn(() => ({
    organization: { findUnique: db.findUnique, update: db.update },
  })),
}));

function sessionFor(role: "owner" | "member" = "owner", organizationId = "org-a"): Session {
  return {
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: {
      id: "user-1",
      organizationId,
      email: "owner@tenant.test",
      emailVerifiedAt: new Date(),
      name: null,
      image: null,
      role,
      createdAt: new Date(),
    },
  };
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/settings/organization", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  db.findUnique.mockReset();
  db.update.mockReset();
  auth.session = null;
});

describe("GET /api/settings/organization", () => {
  it("rejects a signed-out request with 401", async () => {
    const { GET } = await import("../src/app/api/settings/organization/route");
    const response = await GET();
    expect(response.status).toBe(401);
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it("returns the caller's own organization, scoped by id", async () => {
    auth.session = sessionFor("member", "org-a");
    db.findUnique.mockResolvedValue({ name: "Acme", timezone: "America/New_York" });

    const { GET } = await import("../src/app/api/settings/organization/route");
    const response = await GET();
    const body = await response.json();

    expect(db.findUnique).toHaveBeenCalledWith({
      where: { id: "org-a" },
      select: { name: true, timezone: true },
    });
    expect(body).toEqual({ name: "Acme", timezone: "America/New_York", canEdit: false });
  });

  it("reports canEdit: true for an owner", async () => {
    auth.session = sessionFor("owner", "org-a");
    db.findUnique.mockResolvedValue({ name: "Acme", timezone: "UTC" });

    const { GET } = await import("../src/app/api/settings/organization/route");
    const response = await GET();
    const body = await response.json();

    expect(body.canEdit).toBe(true);
  });
});

describe("PATCH /api/settings/organization", () => {
  it("rejects a signed-out request with 401", async () => {
    const { PATCH } = await import("../src/app/api/settings/organization/route");
    const response = await PATCH(patchRequest({ name: "Acme", timezone: "UTC" }));
    expect(response.status).toBe(401);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a member's request with 403", async () => {
    auth.session = sessionFor("member");
    const { PATCH } = await import("../src/app/api/settings/organization/route");
    const response = await PATCH(patchRequest({ name: "Acme", timezone: "UTC" }));
    expect(response.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a blank name with 400", async () => {
    auth.session = sessionFor("owner");
    const { PATCH } = await import("../src/app/api/settings/organization/route");
    const response = await PATCH(patchRequest({ name: "  ", timezone: "UTC" }));
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a timezone that isn't a valid IANA identifier with 400", async () => {
    auth.session = sessionFor("owner");
    const { PATCH } = await import("../src/app/api/settings/organization/route");
    const response = await PATCH(patchRequest({ name: "Acme", timezone: "Not/AZone" }));
    expect(response.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates the caller's own organization, scoped by id", async () => {
    auth.session = sessionFor("owner", "org-a");
    db.update.mockResolvedValue({ name: "New Name", timezone: "Europe/London" });

    const { PATCH } = await import("../src/app/api/settings/organization/route");
    const response = await PATCH(patchRequest({ name: "New Name", timezone: "Europe/London" }));
    const body = await response.json();

    expect(db.update).toHaveBeenCalledWith({
      where: { id: "org-a" },
      data: { name: "New Name", timezone: "Europe/London" },
      select: { name: true, timezone: true },
    });
    expect(body).toEqual({ name: "New Name", timezone: "Europe/London", canEdit: true });
  });
});
