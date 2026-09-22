/**
 * E-18 (task 4.5): a local edit to an imported calendar (an `override`
 * version on top of the latest `imported` one — task 4.6's calendar editor)
 * must survive the next Zendesk business-hours sync. Before this fix,
 * `ensureScheduleCalendarVersion` compared Zendesk's unchanged schedule
 * against whatever version was *latest* (which could be the override),
 * found no difference, and silently kept the override in place only by
 * accident of comparison — any future real Zendesk-side change would then
 * be compared against the override's content instead of the last-imported
 * content, and could either wrongly no-op or wrongly appear "changed". The
 * fix (mirroring `upsertPolicyVersion` for SLA policies) always compares
 * against the latest *imported* version specifically.
 *
 * Real Postgres, like zendesk-sla-policy-position.test.ts (which this suite
 * mirrors the setup of). Needs a migrated database at TEST_DATABASE_URL
 * whose name contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Zendesk business calendar import — E-18 (real Postgres)", () => {
  let prisma: PrismaClient;
  let zendesk: typeof import("@sla/zendesk");

  let organizationId: string;
  let integrationId: string;

  beforeAll(async () => {
    const name = new URL(TEST_DATABASE_URL!).pathname.replace(/^\//, "");
    if (!/test/i.test(name)) {
      throw new Error(`TEST_DATABASE_URL points at database "${name}"; this suite truncates every table.`);
    }
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    prisma = (await import("@sla/db")).getPrismaClient();
    zendesk = await import("@sla/zendesk");
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`,
    );

    const organization = await prisma.organization.create({ data: { name: "Calendar Import Org" } });
    organizationId = organization.id;
    const integration = await prisma.integration.create({
      data: { organizationId, provider: "zendesk", credentials: { subdomain: "demo" } },
    });
    integrationId = integration.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const schedule = {
    id: 42,
    name: "Business Hours",
    time_zone: "UTC",
    intervals: [{ start_time: 9 * 60, end_time: 17 * 60 }],
  };

  async function writeScheduleSnapshot(overrides: Partial<typeof schedule> = {}) {
    const event = zendesk.mapBusinessHoursScheduleToRawEvent({ ...schedule, ...overrides });
    // createMany + skipDuplicates, like the real writeRawEvents helper
    // backfill.ts uses — re-writing an unchanged schedule snapshot (same
    // content, same content-hashed providerEventId) is a no-op, not an error.
    await prisma.rawEvent.createMany({
      data: [
        {
          integrationId,
          providerEventId: event.providerEventId,
          sourceHash: event.sourceHash,
          payload: event.payload as object,
        },
      ],
      skipDuplicates: true,
    });
  }

  async function writeHolidaySnapshot(
    holidays: { id: number; name: string; start_date: string; end_date: string }[],
  ) {
    const event = zendesk.mapScheduleHolidaysToRawEvent({ scheduleId: schedule.id, holidays });
    await prisma.rawEvent.create({
      data: {
        integrationId,
        providerEventId: event.providerEventId,
        sourceHash: event.sourceHash,
        payload: event.payload as object,
      },
    });
  }

  it("creates an imported calendar and version, with holiday names captured", async () => {
    await writeScheduleSnapshot();
    await writeHolidaySnapshot([{ id: 1, name: "Christmas", start_date: "2026-12-25", end_date: "2026-12-25" }]);

    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);
    expect(result).toEqual({ schedulesEvaluated: 1, calendarVersionsCreated: 1, schedulesWithUnresolvedTimeZone: 0 });

    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    expect(calendar.source).toBe("imported");
    expect(calendar.versions).toHaveLength(1);
    expect(calendar.versions[0]).toMatchObject({
      version: 1,
      source: "imported",
      holidays: ["2026-12-25"],
      holidayNames: { "2026-12-25": "Christmas" },
    });
  });

  // 4g: Zendesk's own Rails-style display name is normalized to the
  // canonical IANA id before it's stored — the engine and every later
  // calendar edit only ever see a valid IANA timezone.
  it("normalizes a Zendesk Rails-style timezone name to a canonical IANA id", async () => {
    await writeScheduleSnapshot({ time_zone: "Eastern Time (US & Canada)" });
    await writeHolidaySnapshot([]);

    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);
    expect(result).toEqual({ schedulesEvaluated: 1, calendarVersionsCreated: 1, schedulesWithUnresolvedTimeZone: 0 });

    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    expect(calendar.versions[0]!.timezone).toBe("America/New_York");
  });

  // 4g: an unresolvable timezone must never be guessed at — the schedule is
  // skipped (no calendar/version written) and counted, not silently
  // imported under a wrong or invalid timezone.
  it("skips and counts a schedule whose timezone can't be resolved, instead of guessing", async () => {
    await writeScheduleSnapshot({ time_zone: "Not A Real Zendesk Timezone" });
    await writeHolidaySnapshot([]);

    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);
    expect(result).toEqual({ schedulesEvaluated: 1, calendarVersionsCreated: 0, schedulesWithUnresolvedTimeZone: 1 });

    const calendar = await prisma.businessCalendar.findFirst({
      where: { organizationId, externalId: "42" },
    });
    expect(calendar).toBeNull();
  });

  it("leaves an already-imported calendar's last good version untouched when a later sync reports an unresolvable timezone", async () => {
    await writeScheduleSnapshot({ time_zone: "UTC" });
    await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    await writeScheduleSnapshot({ time_zone: "Somewhere Made Up" });
    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);
    expect(result.schedulesWithUnresolvedTimeZone).toBe(1);
    expect(result.calendarVersionsCreated).toBe(0);

    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    expect(calendar.versions).toHaveLength(1);
    expect(calendar.versions[0]!.timezone).toBe("UTC");
  });

  it("is a no-op on an unchanged re-import", async () => {
    await writeScheduleSnapshot();
    await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    await writeScheduleSnapshot(); // same content, new RawEvent snapshot
    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    expect(result.calendarVersionsCreated).toBe(0);
    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    expect(calendar.versions).toHaveLength(1);
  });

  it("E-18: a local override survives an unchanged re-import instead of being reverted", async () => {
    await writeScheduleSnapshot();
    await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    const importedVersion = calendar.versions[0]!;

    // Simulate a local edit (task 4.6's calendar editor) on top of the
    // imported version — different hours, source "override".
    const overrideVersion = await prisma.businessCalendarVersion.create({
      data: {
        calendarId: calendar.id,
        version: importedVersion.version + 1,
        timezone: "UTC",
        weekly: [{ day: 1, openMinute: 8 * 60, closeMinute: 18 * 60 }],
        holidays: [],
        alwaysOpen: false,
        source: "override",
      },
    });

    // Re-import with the exact same (unchanged) Zendesk schedule content.
    await writeScheduleSnapshot();
    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    expect(result.calendarVersionsCreated).toBe(0);
    const afterImport = await prisma.businessCalendar.findFirstOrThrow({
      where: { id: calendar.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    // The override is still the latest version — never reverted.
    expect(afterImport.versions[0]!.id).toBe(overrideVersion.id);
    expect(afterImport.versions[0]!.source).toBe("override");
  });

  it("a real Zendesk-side change still creates a new imported version on top of an override", async () => {
    await writeScheduleSnapshot();
    await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    const calendar = await prisma.businessCalendar.findFirstOrThrow({
      where: { organizationId, externalId: "42" },
      include: { versions: true },
    });
    await prisma.businessCalendarVersion.create({
      data: {
        calendarId: calendar.id,
        version: calendar.versions[0]!.version + 1,
        timezone: "UTC",
        weekly: [{ day: 1, openMinute: 8 * 60, closeMinute: 18 * 60 }],
        holidays: [],
        alwaysOpen: false,
        source: "override",
      },
    });

    // A genuine change on the Zendesk side (different hours) — Monday
    // (day 1) 10:00-16:00: start_time/end_time are minutes since Sunday
    // 00:00, so Monday's offset is one full day (1440 minutes) ahead.
    await writeScheduleSnapshot({
      intervals: [{ start_time: 1 * 24 * 60 + 10 * 60, end_time: 1 * 24 * 60 + 16 * 60 }],
    });
    const result = await zendesk.runZendeskBusinessCalendarImport(prisma, integrationId);

    expect(result.calendarVersionsCreated).toBe(1);
    const afterImport = await prisma.businessCalendar.findFirstOrThrow({
      where: { id: calendar.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    expect(afterImport.versions[0]!.version).toBe(3);
    expect(afterImport.versions[0]!.source).toBe("imported");
    expect(afterImport.versions[0]!.weekly).toEqual([{ day: 1, openMinute: 10 * 60, closeMinute: 16 * 60 }]);
  });
});
