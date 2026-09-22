import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@sla/db";
import {
  createNativePolicy,
  CustomerIdsNotFoundError,
  NotANativePolicyError,
  setPolicyActive,
  updateNativePolicy,
} from "../src/native-policy";
import { PolicyNotFoundError } from "../src/override";
import { CalendarNotFoundError } from "../src/customer-calendar";
import { DEFAULT_CALENDAR_NAME } from "../src/default-calendar";

interface PolicyRow {
  id: string;
  organizationId: string;
  name: string;
  source: "imported" | "native";
  deactivatedAt: Date | null;
}

interface VersionRow {
  id: string;
  policyId: string;
  version: number;
  match: unknown;
  targets: unknown;
  pauseOnStates: string[];
  calendarVersionId: string;
  calendarIsExplicit: boolean;
  warnAtPercent: number[];
  effectiveFrom: Date;
  source: string;
}

interface CalendarVersionRow {
  id: string;
  version: number;
  timezone: string;
  weekly: unknown;
  holidays: string[];
  alwaysOpen: boolean;
}

interface CalendarRow {
  id: string;
  organizationId: string;
  name: string;
  versions: CalendarVersionRow[];
}

interface CustomerRow {
  id: string;
  organizationId: string;
}

interface OrganizationRow {
  id: string;
  defaultCalendarId: string | null;
}

/** In-memory stand-in for the Prisma delegates native-policy.ts (and the calendar-fallback module it now calls) touches. */
function fakePrisma(opts: {
  policies?: PolicyRow[];
  versions?: VersionRow[];
  calendars?: CalendarRow[];
  customers?: CustomerRow[];
  organizations?: OrganizationRow[];
}) {
  const policies = opts.policies ?? [];
  const versions = opts.versions ?? [];
  const calendars = opts.calendars ?? [];
  const customers = opts.customers ?? [];
  const organizations = opts.organizations ?? [{ id: "org_a", defaultCalendarId: null }];
  const createdPolicies: PolicyRow[] = [];
  const createdVersions: VersionRow[] = [];
  const updatedPolicies: { id: string; data: Partial<PolicyRow> }[] = [];
  const createdCalendars: CalendarRow[] = [];

  const prisma = {
    sLAPolicy: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; organizationId: string };
      }) =>
        [...policies, ...createdPolicies].find(
          (p) => p.id === where.id && p.organizationId === where.organizationId,
        ) ?? null,
      create: async ({ data }: { data: Omit<PolicyRow, "id" | "deactivatedAt"> }) => {
        const row: PolicyRow = {
          id: `pol_${createdPolicies.length + policies.length + 1}`,
          deactivatedAt: null,
          ...data,
        };
        createdPolicies.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<PolicyRow>;
      }) => {
        updatedPolicies.push({ id: where.id, data });
        return { id: where.id, ...data };
      },
    },
    sLAPolicyVersion: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { policyId: string };
        orderBy: { version: "desc" };
      }) => {
        expect(orderBy).toEqual({ version: "desc" });
        const rows = [...versions, ...createdVersions]
          .filter((v) => v.policyId === where.policyId)
          .sort((a, b) => b.version - a.version);
        return rows[0] ?? null;
      },
      create: async ({ data }: { data: Omit<VersionRow, "id"> }) => {
        const row = { id: `ver_${createdVersions.length + versions.length + 1}`, ...data };
        createdVersions.push(row);
        return row;
      },
    },
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        organizations.find((o) => o.id === where.id) ?? null,
    },
    businessCalendar: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; organizationId: string; name?: string };
      }) =>
        [...calendars, ...createdCalendars].find(
          (c) =>
            c.organizationId === where.organizationId &&
            (where.id === undefined || c.id === where.id) &&
            (where.name === undefined || c.name === where.name),
        ) ?? null,
      create: async ({
        data,
      }: {
        data: {
          organizationId: string;
          name: string;
          source: string;
          versions: { create: Omit<CalendarVersionRow, "id"> & { source: string } };
        };
      }) => {
        const n = createdCalendars.length + 1;
        const row: CalendarRow = {
          id: `cal_auto_${n}`,
          organizationId: data.organizationId,
          name: data.name,
          versions: [{ id: `calv_auto_${n}`, ...data.versions.create }],
        };
        createdCalendars.push(row);
        return row;
      },
    },
    customer: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; organizationId: string };
      }) =>
        customers.filter(
          (c) => where.id.in.includes(c.id) && c.organizationId === where.organizationId,
        ),
    },
  };
  return {
    prisma: prisma as unknown as PrismaClient,
    createdPolicies,
    createdVersions,
    updatedPolicies,
    createdCalendars,
  };
}

const calendars: CalendarRow[] = [
  {
    id: "cal_1",
    organizationId: "org_a",
    name: "Cal One",
    versions: [{ id: "calv_1", version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: false }],
  },
  {
    id: "cal_1_v2",
    organizationId: "org_a",
    name: "Cal One v2 holder",
    versions: [],
  },
  {
    id: "cal_org_default",
    organizationId: "org_a",
    name: "Org Default",
    versions: [
      { id: "calv_org_default", version: 1, timezone: "America/New_York", weekly: [], holidays: [], alwaysOpen: false },
    ],
  },
  {
    id: "cal_other",
    organizationId: "org_b",
    name: "Other org cal",
    versions: [{ id: "calv_other", version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: false }],
  },
];

const customers: CustomerRow[] = [
  { id: "cust_1", organizationId: "org_a" },
  { id: "cust_other", organizationId: "org_b" },
];

function version(overrides: Partial<VersionRow> & Pick<VersionRow, "id" | "version">): VersionRow {
  return {
    policyId: "pol_1",
    match: { priority: ["urgent"] },
    targets: [{ kind: "resolution", minutes: 480 }],
    pauseOnStates: ["pending_customer"],
    calendarVersionId: "calv_1",
    calendarIsExplicit: true,
    warnAtPercent: [50, 80, 95],
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    source: "native",
    ...overrides,
  };
}

describe("createNativePolicy", () => {
  it("creates a policy and its first version, source native, with an explicit calendar", async () => {
    const { prisma, createdPolicies, createdVersions } = fakePrisma({ calendars, customers });

    const result = await createNativePolicy(prisma, "org_a", "My Policy", {
      match: { priority: ["urgent"], customerIds: ["cust_1"] },
      targets: [{ kind: "resolution", minutes: 240 }],
      calendarId: "cal_1",
      warnAtPercent: [50, 80],
    });

    expect(createdPolicies).toEqual([
      { id: "pol_1", organizationId: "org_a", name: "My Policy", source: "native", deactivatedAt: null },
    ]);
    expect(createdVersions).toHaveLength(1);
    expect(createdVersions[0]).toMatchObject({
      policyId: "pol_1",
      version: 1,
      match: { priority: ["urgent"], customerIds: ["cust_1"] },
      targets: [{ kind: "resolution", minutes: 240 }],
      calendarVersionId: "calv_1",
      calendarIsExplicit: true,
      warnAtPercent: [50, 80],
      source: "native",
    });
    expect(result).toEqual({ policyId: "pol_1", version: { id: "ver_1", version: 1 } });
  });

  it("throws CalendarNotFoundError for a calendar from another organization", async () => {
    const { prisma } = fakePrisma({ calendars, customers });

    await expect(
      createNativePolicy(prisma, "org_a", "My Policy", {
        match: {},
        targets: [{ kind: "resolution", minutes: 240 }],
        calendarId: "cal_other",
        warnAtPercent: [],
      }),
    ).rejects.toBeInstanceOf(CalendarNotFoundError);
  });

  it("throws CustomerIdsNotFoundError for a customer id from another organization", async () => {
    const { prisma } = fakePrisma({ calendars, customers });

    await expect(
      createNativePolicy(prisma, "org_a", "My Policy", {
        match: { customerIds: ["cust_other"] },
        targets: [{ kind: "resolution", minutes: 240 }],
        calendarId: "cal_1",
        warnAtPercent: [],
      }),
    ).rejects.toBeInstanceOf(CustomerIdsNotFoundError);
  });

  // 4i, requirement #2: native policy with no explicit calendar + an
  // organization default -> uses the organization's default calendar, not
  // Always Open.
  it("with no calendarId and an organization default set, resolves to the organization's default calendar", async () => {
    const { prisma, createdVersions, createdCalendars } = fakePrisma({
      calendars,
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: "cal_org_default" }],
    });

    const result = await createNativePolicy(prisma, "org_a", "No calendar chosen", {
      match: {},
      targets: [{ kind: "resolution", minutes: 240 }],
      warnAtPercent: [],
    });

    expect(createdVersions[0]).toMatchObject({
      calendarVersionId: "calv_org_default",
      calendarIsExplicit: false,
    });
    expect(result.policyId).toBeDefined();
    // Never silently creates/reaches for the Always Open calendar when a
    // valid organization default already resolves.
    expect(createdCalendars).toHaveLength(0);
  });

  // 4i, requirement #3: no explicit calendar + no organization default ->
  // falls back to the system Always Open calendar (created on demand for an
  // organization that never connected a ticket source).
  it("with no calendarId and no organization default, falls back to Always Open, creating it if needed", async () => {
    const { prisma, createdVersions, createdCalendars } = fakePrisma({
      calendars,
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: null }],
    });

    await createNativePolicy(prisma, "org_a", "No calendar, no default", {
      match: {},
      targets: [{ kind: "resolution", minutes: 240 }],
      warnAtPercent: [],
    });

    expect(createdCalendars).toHaveLength(1);
    expect(createdCalendars[0]).toMatchObject({ organizationId: "org_a", name: DEFAULT_CALENDAR_NAME });
    expect(createdVersions[0]).toMatchObject({
      calendarVersionId: createdCalendars[0]!.versions[0]!.id,
      calendarIsExplicit: false,
    });
    expect(createdCalendars[0]!.versions[0]).toMatchObject({ alwaysOpen: true });
  });

  it("reuses an already-existing Always Open calendar instead of creating a second one", async () => {
    const existingAlwaysOpen: CalendarRow = {
      id: "cal_always_open",
      organizationId: "org_a",
      name: DEFAULT_CALENDAR_NAME,
      versions: [{ id: "calv_always_open", version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: true }],
    };
    const { prisma, createdVersions, createdCalendars } = fakePrisma({
      calendars: [...calendars, existingAlwaysOpen],
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: null }],
    });

    await createNativePolicy(prisma, "org_a", "No calendar", {
      match: {},
      targets: [{ kind: "resolution", minutes: 240 }],
      warnAtPercent: [],
    });

    expect(createdCalendars).toHaveLength(0);
    expect(createdVersions[0]).toMatchObject({ calendarVersionId: "calv_always_open", calendarIsExplicit: false });
  });
});

describe("updateNativePolicy", () => {
  const policies: PolicyRow[] = [
    { id: "pol_1", organizationId: "org_a", name: "My Policy", source: "native", deactivatedAt: null },
    { id: "pol_imported", organizationId: "org_a", name: "Imported", source: "imported", deactivatedAt: null },
    { id: "pol_other", organizationId: "org_b", name: "Other org", source: "native", deactivatedAt: null },
  ];

  it("appends a new version with only the changed fields updated", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      versions: [version({ id: "ver_1", version: 1 })],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", {
      targets: [{ kind: "resolution", minutes: 120 }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      version: 2,
      match: { priority: ["urgent"] },
      targets: [{ kind: "resolution", minutes: 120 }],
      calendarVersionId: "calv_1",
      calendarIsExplicit: true,
      source: "native",
    });
  });

  it("is a no-op when the submitted content matches the latest version exactly", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      versions: [version({ id: "ver_1", version: 1 })],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", {
      match: { priority: ["urgent"] },
      targets: [{ kind: "resolution", minutes: 480 }],
    });

    expect(result).toEqual({ created: false, policyId: "pol_1", version: { id: "ver_1", version: 1 } });
    expect(createdVersions).toHaveLength(0);
  });

  it("throws NotANativePolicyError for an imported policy", async () => {
    const { prisma } = fakePrisma({
      policies,
      calendars,
      customers,
      versions: [version({ id: "ver_1", version: 1, policyId: "pol_imported" })],
    });

    await expect(
      updateNativePolicy(prisma, "org_a", "pol_imported", { targets: [{ kind: "resolution", minutes: 1 }] }),
    ).rejects.toBeInstanceOf(NotANativePolicyError);
  });

  it("throws PolicyNotFoundError for another organization's policy", async () => {
    const { prisma } = fakePrisma({
      policies,
      calendars,
      customers,
      versions: [version({ id: "ver_x", version: 1, policyId: "pol_other" })],
    });

    await expect(
      updateNativePolicy(prisma, "org_a", "pol_other", { targets: [{ kind: "resolution", minutes: 1 }] }),
    ).rejects.toBeInstanceOf(PolicyNotFoundError);
  });

  // 4i, requirement #4: re-saving a native policy must not incorrectly
  // replace an absent calendar with Always Open (or anything else) — the
  // absent state, and whatever it last resolved to, are simply carried
  // forward untouched when calendarId isn't part of the edit.
  it("carries an absent calendar forward untouched when re-saving without touching calendarId", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: "cal_org_default" }],
      versions: [
        version({
          id: "ver_1",
          version: 1,
          calendarVersionId: "calv_org_default",
          calendarIsExplicit: false,
        }),
      ],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", {
      targets: [{ kind: "resolution", minutes: 300 }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      calendarVersionId: "calv_org_default",
      calendarIsExplicit: false,
    });
  });

  it("explicitly switching to 'use organization default' (calendarId: null) clears the explicit pin", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: "cal_org_default" }],
      versions: [version({ id: "ver_1", version: 1, calendarVersionId: "calv_1", calendarIsExplicit: true })],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", { calendarId: null });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      calendarVersionId: "calv_org_default",
      calendarIsExplicit: false,
    });
  });

  it("resubmitting calendarId: null when already absent is a no-op (doesn't churn a fresh snapshot)", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      organizations: [{ id: "org_a", defaultCalendarId: "cal_org_default" }],
      versions: [
        version({
          id: "ver_1",
          version: 1,
          calendarVersionId: "calv_org_default",
          calendarIsExplicit: false,
        }),
      ],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", { calendarId: null });

    expect(result).toEqual({ created: false, policyId: "pol_1", version: { id: "ver_1", version: 1 } });
    expect(createdVersions).toHaveLength(0);
  });

  it("re-picking the same explicit calendar refreshes to its current latest version", async () => {
    const calendarsWithNewerVersion: CalendarRow[] = calendars.map((c) =>
      c.id === "cal_1"
        ? {
            ...c,
            versions: [
              { id: "calv_1_v2", version: 2, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: false },
              c.versions[0]!,
            ],
          }
        : c,
    );
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars: calendarsWithNewerVersion,
      customers,
      versions: [version({ id: "ver_1", version: 1, calendarVersionId: "calv_1", calendarIsExplicit: true })],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", { calendarId: "cal_1" });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({ calendarVersionId: "calv_1_v2", calendarIsExplicit: true });
  });

  it("explicitly pinning a different calendar sets calendarIsExplicit", async () => {
    const { prisma, createdVersions } = fakePrisma({
      policies,
      calendars,
      customers,
      versions: [version({ id: "ver_1", version: 1 })],
    });

    const result = await updateNativePolicy(prisma, "org_a", "pol_1", { calendarId: "cal_org_default" });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      calendarVersionId: "calv_org_default",
      calendarIsExplicit: true,
    });
  });
});

describe("setPolicyActive", () => {
  const policies: PolicyRow[] = [
    { id: "pol_1", organizationId: "org_a", name: "My Policy", source: "native", deactivatedAt: null },
    { id: "pol_imported", organizationId: "org_a", name: "Imported", source: "imported", deactivatedAt: null },
  ];

  it("deactivates then reactivates a native policy", async () => {
    const { prisma, updatedPolicies } = fakePrisma({ policies });

    await setPolicyActive(prisma, "org_a", "pol_1", false);
    expect(updatedPolicies[0]!.data.deactivatedAt).toBeInstanceOf(Date);

    await setPolicyActive(prisma, "org_a", "pol_1", true);
    expect(updatedPolicies[1]!.data.deactivatedAt).toBeNull();
  });

  it("throws NotANativePolicyError for an imported policy", async () => {
    const { prisma } = fakePrisma({ policies });

    await expect(setPolicyActive(prisma, "org_a", "pol_imported", false)).rejects.toBeInstanceOf(
      NotANativePolicyError,
    );
  });

  it("throws PolicyNotFoundError for an unknown policy id", async () => {
    const { prisma } = fakePrisma({ policies });

    await expect(setPolicyActive(prisma, "org_a", "pol_missing", false)).rejects.toBeInstanceOf(
      PolicyNotFoundError,
    );
  });
});
