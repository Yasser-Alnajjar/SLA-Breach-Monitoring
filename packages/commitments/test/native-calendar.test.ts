import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@sla/db";
import { WeeklyWindowValidationError } from "@sla/core";
import { createNativeCalendar, updateCalendar } from "../src/native-calendar";
import { CalendarNotFoundError } from "../src/customer-calendar";

interface CalendarRow {
  id: string;
  organizationId: string;
  name: string;
  source: "imported" | "native";
}

interface VersionRow {
  id: string;
  calendarId: string;
  version: number;
  timezone: string;
  weekly: unknown;
  holidays: string[];
  holidayNames: Record<string, string> | null;
  holidayDefinitions: unknown;
  alwaysOpen: boolean;
  source: string;
}

function fakePrisma(opts: { calendars?: CalendarRow[]; versions?: VersionRow[] }) {
  const calendars = opts.calendars ?? [];
  const versions = opts.versions ?? [];
  const createdCalendars: CalendarRow[] = [];
  const createdVersions: VersionRow[] = [];
  const updatedCalendars: { id: string; data: Partial<CalendarRow> }[] = [];

  const prisma = {
    businessCalendar: {
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        [...calendars, ...createdCalendars].find(
          (c) => c.id === where.id && c.organizationId === where.organizationId,
        ) ?? null,
      create: async ({ data }: { data: Omit<CalendarRow, "id"> }) => {
        const row: CalendarRow = { id: `cal_${createdCalendars.length + calendars.length + 1}`, ...data };
        createdCalendars.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<CalendarRow> }) => {
        updatedCalendars.push({ id: where.id, data });
        return { id: where.id, ...data };
      },
    },
    businessCalendarVersion: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { calendarId: string };
        orderBy: { version: "desc" };
      }) => {
        expect(orderBy).toEqual({ version: "desc" });
        const rows = [...versions, ...createdVersions]
          .filter((v) => v.calendarId === where.calendarId)
          .sort((a, b) => b.version - a.version);
        return rows[0] ?? null;
      },
      create: async ({ data }: { data: Omit<VersionRow, "id"> }) => {
        const row = { id: `calv_${createdVersions.length + versions.length + 1}`, ...data };
        createdVersions.push(row);
        return row;
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, createdCalendars, createdVersions, updatedCalendars };
}

function version(overrides: Partial<VersionRow> & Pick<VersionRow, "id" | "version">): VersionRow {
  return {
    calendarId: "cal_1",
    timezone: "UTC",
    weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
    holidays: ["2026-12-25"],
    holidayNames: { "2026-12-25": "Christmas" },
    holidayDefinitions: null,
    alwaysOpen: false,
    source: "imported",
    ...overrides,
  };
}

describe("createNativeCalendar", () => {
  it("creates a calendar and its first version, source native, expanding holidays", async () => {
    const { prisma, createdCalendars, createdVersions } = fakePrisma({});

    const result = await createNativeCalendar(prisma, "org_a", "24/7", {
      timezone: "America/New_York",
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
      holidays: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
    });

    expect(createdCalendars).toEqual([
      { id: "cal_1", organizationId: "org_a", name: "24/7", source: "native" },
    ]);
    expect(createdVersions).toHaveLength(1);
    expect(createdVersions[0]).toMatchObject({
      calendarId: "cal_1",
      version: 1,
      timezone: "America/New_York",
      holidays: ["2026-12-25"],
      holidayNames: { "2026-12-25": "Christmas" },
      // 4h: the original input is persisted verbatim alongside the expanded
      // occurrences, so reopening the editor shows the same one-off/recurring
      // holiday it was given, not a reconstruction.
      holidayDefinitions: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
      alwaysOpen: false,
      source: "native",
    });
    expect(result).toEqual({ calendarId: "cal_1", version: { id: "calv_1", version: 1 } });
  });

  it("stores weekly exactly as given — unselected weekdays are omitted, never written as closed entries", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await createNativeCalendar(prisma, "org_a", "Mon/Wed", {
      timezone: "UTC",
      weekly: [
        { day: 1, openMinute: 540, closeMinute: 1020 },
        { day: 3, openMinute: 540, closeMinute: 1020 },
      ],
      holidays: [],
    });

    expect(createdVersions[0]!.weekly).toEqual([
      { day: 1, openMinute: 540, closeMinute: 1020 },
      { day: 3, openMinute: 540, closeMinute: 1020 },
    ]);
  });

  // 4b: a native calendar is always alwaysOpen: false, so it must have at
  // least one working-hours window — an empty schedule has zero working
  // time and every deadline computed against it would fail outright.
  it("rejects an empty weekly — a normal calendar needs at least one window", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await expect(
      createNativeCalendar(prisma, "org_a", "Nothing selected", { timezone: "UTC", weekly: [], holidays: [] }),
    ).rejects.toBeInstanceOf(WeeklyWindowValidationError);
    expect(createdVersions).toHaveLength(0);
  });

  it("accepts a single-window weekly", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await createNativeCalendar(prisma, "org_a", "Mon only", {
      timezone: "UTC",
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
      holidays: [],
    });

    expect(createdVersions[0]).toMatchObject({ alwaysOpen: false });
  });

  it("preserves multiple windows on the same day (split shift) — 4c", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await createNativeCalendar(prisma, "org_a", "Split shift", {
      timezone: "UTC",
      weekly: [
        { day: 1, openMinute: 540, closeMinute: 720 },
        { day: 1, openMinute: 780, closeMinute: 1020 },
      ],
      holidays: [],
    });

    expect(createdVersions[0]!.weekly).toEqual([
      { day: 1, openMinute: 540, closeMinute: 720 },
      { day: 1, openMinute: 780, closeMinute: 1020 },
    ]);
  });

  it("rejects overlapping windows on the same day — 4f", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await expect(
      createNativeCalendar(prisma, "org_a", "Overlap", {
        timezone: "UTC",
        weekly: [
          { day: 1, openMinute: 540, closeMinute: 1020 },
          { day: 1, openMinute: 900, closeMinute: 1080 },
        ],
        holidays: [],
      }),
    ).rejects.toBeInstanceOf(WeeklyWindowValidationError);
    expect(createdVersions).toHaveLength(0);
  });

  it("rejects fractional minutes — 4f", async () => {
    const { prisma } = fakePrisma({});

    await expect(
      createNativeCalendar(prisma, "org_a", "Fractional", {
        timezone: "UTC",
        weekly: [{ day: 1, openMinute: 540.5, closeMinute: 1020 }],
        holidays: [],
      }),
    ).rejects.toBeInstanceOf(WeeklyWindowValidationError);
  });

  it("accepts a full 24-hour window (closeMinute: 1440) — 4e", async () => {
    const { prisma, createdVersions } = fakePrisma({});

    await createNativeCalendar(prisma, "org_a", "Full day Monday", {
      timezone: "UTC",
      weekly: [{ day: 1, openMinute: 0, closeMinute: 1440 }],
      holidays: [],
    });

    expect(createdVersions[0]!.weekly).toEqual([{ day: 1, openMinute: 0, closeMinute: 1440 }]);
  });
});

describe("updateCalendar", () => {
  const calendars: CalendarRow[] = [
    { id: "cal_1", organizationId: "org_a", name: "Imported schedule", source: "imported" },
    { id: "cal_native", organizationId: "org_a", name: "Native", source: "native" },
    { id: "cal_other", organizationId: "org_b", name: "Other org", source: "native" },
  ];

  it("appends an override version when editing an imported calendar's hours", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_1", {
      weekly: [{ day: 2, openMinute: 480, closeMinute: 1000 }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      version: 2,
      timezone: "UTC",
      weekly: [{ day: 2, openMinute: 480, closeMinute: 1000 }],
      holidays: ["2026-12-25"],
      source: "override",
    });
  });

  it("appends a native version when editing a native calendar", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_n1", version: 1, calendarId: "cal_native", source: "native" })],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_native", { timezone: "UTC+1" });

    expect(result.created).toBe(true);
    expect(createdVersions[0]!.source).toBe("native");
  });

  // Current behavior, pinned by the calendar audit: `alwaysOpen` is not part
  // of the edit input and is copied from the latest version, so editing the
  // hours of an always-open calendar (e.g. the system "Always open" default)
  // stores them but the engine keeps ignoring them. Change deliberately.
  it("carries alwaysOpen forward from the latest version, even when weekly hours are edited", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({ id: "calv_n1", version: 1, calendarId: "cal_native", source: "native", weekly: [], alwaysOpen: true }),
      ],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_native", {
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]).toMatchObject({
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
      alwaysOpen: true,
    });
  });

  it("expands recurring holidays at save time", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    await updateCalendar(prisma, "org_a", "cal_1", {
      holidays: [{ date: "01-01", name: "New Year", recurring: true }],
    });

    expect(createdVersions[0]!.holidays.length).toBeGreaterThan(1);
    for (const date of createdVersions[0]!.holidays) {
      expect(date).toMatch(/^\d{4}-01-01$/);
    }
  });

  // 4h: the recurring definition itself is persisted, not just its expanded
  // occurrences — otherwise reopening the editor could only ever reconstruct
  // one-off dates.
  it("persists the recurring holiday definition alongside its expanded occurrences — 4h", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    await updateCalendar(prisma, "org_a", "cal_1", {
      holidays: [{ date: "01-01", name: "New Year", recurring: true }],
    });

    expect(createdVersions[0]!.holidayDefinitions).toEqual([
      { date: "01-01", name: "New Year", recurring: true },
    ]);
  });

  it("preserves a recurring holiday's recurrence when a later edit doesn't touch holidays — 4h", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({
          id: "calv_1",
          version: 1,
          holidayDefinitions: [{ date: "01-01", name: "New Year", recurring: true }],
        }),
      ],
    });

    // Edit an unrelated field (working hours) — never touching holidays.
    await updateCalendar(prisma, "org_a", "cal_1", {
      weekly: [{ day: 2, openMinute: 480, closeMinute: 1000 }],
    });

    expect(createdVersions[0]!.holidayDefinitions).toEqual([
      { date: "01-01", name: "New Year", recurring: true },
    ]);
    // The generated occurrences (whatever the latest version already had)
    // are carried forward untouched too, same as any other unedited field.
    expect(createdVersions[0]!.holidays).toEqual(["2026-12-25"]);
  });

  it("changing a one-off holiday to recurring on the same-looking date is a real change, not a no-op — 4h", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({
          id: "calv_1",
          version: 1,
          holidays: ["2026-12-25"],
          holidayNames: { "2026-12-25": "Christmas" },
          holidayDefinitions: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
        }),
      ],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_1", {
      holidays: [{ date: "12-25", name: "Christmas", recurring: true }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]!.holidayDefinitions).toEqual([
      { date: "12-25", name: "Christmas", recurring: true },
    ]);
  });

  it("is a no-op when the submitted content matches the latest version exactly", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({
          id: "calv_1",
          version: 1,
          holidayDefinitions: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
        }),
      ],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_1", {
      timezone: "UTC",
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
      holidays: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
    });

    expect(result).toEqual({ created: false, calendarId: "cal_1", version: { id: "calv_1", version: 1 } });
    expect(createdVersions).toHaveLength(0);
  });

  it("resubmitting the same flat holidays for a version with no recorded definition captures it (not a no-op)", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })], // holidayDefinitions: null (legacy/never edited via the native form)
    });

    const result = await updateCalendar(prisma, "org_a", "cal_1", {
      timezone: "UTC",
      weekly: [{ day: 1, openMinute: 540, closeMinute: 1020 }],
      holidays: [{ date: "2026-12-25", name: "Christmas", recurring: false }],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]!.holidayDefinitions).toEqual([
      { date: "2026-12-25", name: "Christmas", recurring: false },
    ]);
  });

  it("throws CalendarNotFoundError for another organization's calendar", async () => {
    const { prisma } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_x", version: 1, calendarId: "cal_other" })],
    });

    await expect(updateCalendar(prisma, "org_a", "cal_other", { timezone: "UTC" })).rejects.toBeInstanceOf(
      CalendarNotFoundError,
    );
  });

  // 4b: enforced at the domain layer, not only the UI — a normal (non
  // Always Open) calendar can't be edited down to zero working hours.
  it("rejects editing a normal calendar's weekly down to empty", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    await expect(updateCalendar(prisma, "org_a", "cal_1", { weekly: [] })).rejects.toBeInstanceOf(
      WeeklyWindowValidationError,
    );
    expect(createdVersions).toHaveLength(0);
  });

  it("allows an Always Open calendar's weekly to be edited to empty", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({ id: "calv_n1", version: 1, calendarId: "cal_native", source: "native", weekly: [], alwaysOpen: true }),
      ],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_native", { weekly: [] });

    // Same content as the latest version (empty weekly, alwaysOpen carried
    // forward) — a genuine no-op, not a rejection.
    expect(result.created).toBe(false);
    expect(createdVersions).toHaveLength(0);
  });

  it("rejects overlapping windows on edit — 4f", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    await expect(
      updateCalendar(prisma, "org_a", "cal_1", {
        weekly: [
          { day: 1, openMinute: 540, closeMinute: 1020 },
          { day: 1, openMinute: 900, closeMinute: 1080 },
        ],
      }),
    ).rejects.toBeInstanceOf(WeeklyWindowValidationError);
    expect(createdVersions).toHaveLength(0);
  });

  it("does not validate a legacy weekly that wasn't touched by this edit", async () => {
    // The stored weekly already overlaps (pre-4f data) — editing only the
    // name must not retroactively reject it.
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [
        version({
          id: "calv_1",
          version: 1,
          weekly: [
            { day: 1, openMinute: 540, closeMinute: 1020 },
            { day: 1, openMinute: 900, closeMinute: 1080 },
          ],
        }),
      ],
    });

    await expect(updateCalendar(prisma, "org_a", "cal_1", {})).resolves.toBeDefined();
    expect(createdVersions).toHaveLength(0); // no-op: nothing was actually changed
  });

  it("preserves multiple windows on the same day through an edit — 4c", async () => {
    const { prisma, createdVersions } = fakePrisma({
      calendars,
      versions: [version({ id: "calv_1", version: 1 })],
    });

    const result = await updateCalendar(prisma, "org_a", "cal_1", {
      weekly: [
        { day: 1, openMinute: 540, closeMinute: 720 },
        { day: 1, openMinute: 780, closeMinute: 1020 },
        { day: 3, openMinute: 540, closeMinute: 1020 },
      ],
    });

    expect(result.created).toBe(true);
    expect(createdVersions[0]!.weekly).toEqual([
      { day: 1, openMinute: 540, closeMinute: 720 },
      { day: 1, openMinute: 780, closeMinute: 1020 },
      { day: 3, openMinute: 540, closeMinute: 1020 },
    ]);
  });
});
