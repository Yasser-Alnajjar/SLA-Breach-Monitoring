/**
 * `POST /api/settings/sla-policies/override` kind validation (Step 8): the
 * route's own `VALID_KINDS` gate, not `overridePolicyTargets` itself (already
 * covered directly in packages/commitments/test/override.test.ts). Confirms
 * a `next_reply` target is now accepted end to end, and that an unknown kind
 * is still rejected before anything is written.
 *
 * Real Postgres, like tenant-isolation.test.ts (which this suite mirrors the
 * setup of). Needs a migrated database at TEST_DATABASE_URL whose name
 * contains "test"; skipped when unset.
 */
import type { Session } from "next-auth";
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const auth = vi.hoisted(() => ({ session: null as Session | null }));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => auth.session) }));
// The real options module pulls in bcrypt and the credentials provider;
// the route only passes it through to the mocked getServerSession.
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// `server-only` throws unless bundled for React Server Components.
vi.mock("server-only", () => ({}));

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!TEST_DATABASE_URL)("SLA policy override route (real Postgres)", () => {
  let prisma: PrismaClient;
  let route: typeof import("../src/app/api/settings/sla-policies/override/route");

  let organizationId: string;
  let policyId: string;

  beforeAll(async () => {
    const name = new URL(TEST_DATABASE_URL!).pathname.replace(/^\//, "");
    if (!/test/i.test(name)) {
      throw new Error(`TEST_DATABASE_URL points at database "${name}"; this suite truncates every table.`);
    }
    // @sla/db builds its connection from DATABASE_URL at import time, so the
    // override must land before anything imports it; hence dynamic imports.
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    prisma = (await import("@sla/db")).getPrismaClient();
    route = await import("../src/app/api/settings/sla-policies/override/route");
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`,
    );

    const organization = await prisma.organization.create({ data: { name: "Override Route Org" } });
    organizationId = organization.id;
    const user = await prisma.user.create({
      data: { organizationId, email: "owner@example.test", passwordHash: "unused", role: "owner" },
    });
    auth.session = {
      expires: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: user.id, organizationId, email: user.email, name: null, image: null, role: "owner", createdAt: user.createdAt },
    };

    const calendar = await prisma.businessCalendar.create({
      data: {
        organizationId,
        name: "24/7",
        versions: { create: { version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: true } },
      },
      include: { versions: true },
    });

    const policy = await prisma.sLAPolicy.create({ data: { organizationId, name: "Default" } });
    policyId = policy.id;
    await prisma.sLAPolicyVersion.create({
      data: {
        policyId,
        version: 1,
        match: {},
        targets: [
          { kind: "first_response", minutes: 60 },
          { kind: "resolution", minutes: 480 },
        ],
        pauseOnStates: [],
        calendarVersionId: calendar.versions[0]!.id,
        warnAtPercent: [50, 80, 95],
        effectiveFrom: new Date(),
        source: "imported",
      },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const url = "http://localhost:3000/api/settings/sla-policies/override";

  it("accepts a next_reply target and persists it as a new override version", async () => {
    const response = await route.POST(
      jsonRequest(url, {
        policyId,
        targets: [
          { kind: "first_response", minutes: 60 },
          { kind: "resolution", minutes: 480 },
          { kind: "next_reply", minutes: 30 },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const versions = await prisma.sLAPolicyVersion.findMany({ where: { policyId }, orderBy: { version: "asc" } });
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({
      version: 2,
      source: "override",
      targets: [
        { kind: "first_response", minutes: 60 },
        { kind: "resolution", minutes: 480 },
        { kind: "next_reply", minutes: 30 },
      ],
    });
  });

  it("rejects an unknown commitment kind and writes nothing", async () => {
    const response = await route.POST(
      jsonRequest(url, { policyId, targets: [{ kind: "bogus_kind", minutes: 30 }] }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.sLAPolicyVersion.count({ where: { policyId } })).toBe(1);
  });
});
