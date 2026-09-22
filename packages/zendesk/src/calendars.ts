import type { Prisma, PrismaClient } from "@sla/db";
import {
  calendarVersionContentEquals,
  type CalendarVersionContent,
  type WeeklyWindow,
} from "@sla/core";
import type { ScheduleHolidaysSnapshot } from "./rawEvents";
import type { ZendeskBusinessHoursSchedule, ZendeskScheduleHoliday } from "./types";
import { normalizeZendeskTimeZone } from "./zendesk-timezone";

const MINUTES_PER_DAY = 24 * 60;

/**
 * Zendesk expresses a schedule's open windows as intervals in minutes since
 * Sunday 00:00 in the schedule's own timezone, not as our (day, openMinute,
 * closeMinute) triples. Splitting each interval on the day boundary recovers
 * the shape `computeDeadline`/`workingMinutesBetween` expect. Assumes no
 * interval spans midnight, which matches how Zendesk emits them.
 */
export function intervalsToWeeklyWindows(
  intervals: { start_time: number; end_time: number }[],
): WeeklyWindow[] {
  return intervals.map(({ start_time, end_time }) => {
    const day = Math.floor(start_time / MINUTES_PER_DAY) % 7;
    const openMinute = start_time % MINUTES_PER_DAY;
    return {
      day: day as WeeklyWindow["day"],
      openMinute,
      closeMinute: openMinute + (end_time - start_time),
    };
  });
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Expands each holiday's inclusive [start_date, end_date] range into individual "YYYY-MM-DD" days. */
export function expandHolidayDates(holidays: ZendeskScheduleHoliday[]): string[] {
  const dates = new Set<string>();
  for (const holiday of holidays) {
    const end = new Date(`${holiday.end_date}T00:00:00Z`).getTime();
    let cursorMs = new Date(`${holiday.start_date}T00:00:00Z`).getTime();
    while (cursorMs <= end) {
      dates.add(isoDate(new Date(cursorMs)));
      cursorMs += 24 * 60 * 60_000;
    }
  }
  return [...dates].sort();
}

/**
 * Same expansion as `expandHolidayDates`, but keeps each date's Zendesk
 * holiday name (task 4.5/4.6) — `ZendeskScheduleHoliday.name` already exists
 * on every holiday but was previously discarded. A date covered by more than
 * one holiday range keeps the last one's name, same tie-break `Set` dedup
 * already gives `expandHolidayDates` for the dates themselves.
 */
export function expandHolidayNames(holidays: ZendeskScheduleHoliday[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const holiday of holidays) {
    const end = new Date(`${holiday.end_date}T00:00:00Z`).getTime();
    let cursorMs = new Date(`${holiday.start_date}T00:00:00Z`).getTime();
    while (cursorMs <= end) {
      names[isoDate(new Date(cursorMs))] = holiday.name;
      cursorMs += 24 * 60 * 60_000;
    }
  }
  return names;
}

// `calendarVersionContentEquals` now lives in @sla/core (shared with the
// native calendar editor, packages/commitments/src/native-calendar.ts) —
// re-exported here so this module's existing callers/tests are unaffected.
export { calendarVersionContentEquals };

/**
 * Appends an `imported` version when Zendesk's schedule content differs from
 * the last one we imported. Compares against the latest *imported* version,
 * not the latest version (E-18): a local edit (`source: "override"`, task
 * 4.6) sits on top of an imported version, and comparing Zendesk's
 * unchanged schedule against the override would silently revert it on the
 * next sync — the same fix `upsertPolicyVersion` (./policies.ts) already
 * applies for SLA policies. A real change on the Zendesk side still creates
 * a new imported version, which supersedes any local override.
 */
async function ensureScheduleCalendarVersion(
  prisma: PrismaClient,
  organizationId: string,
  schedule: ZendeskBusinessHoursSchedule,
  holidayDates: string[],
  holidayNames: Record<string, string>,
): Promise<{ id: string; created: boolean }> {
  const desired: CalendarVersionContent = {
    timezone: schedule.time_zone,
    weekly: intervalsToWeeklyWindows(schedule.intervals ?? []),
    holidays: holidayDates,
  };

  const calendar = await prisma.businessCalendar.upsert({
    where: { organizationId_externalId: { organizationId, externalId: String(schedule.id) } },
    update: { name: `Zendesk: ${schedule.name}` },
    create: {
      organizationId,
      externalId: String(schedule.id),
      name: `Zendesk: ${schedule.name}`,
      source: "imported",
    },
  });

  const [latestVersion, latestImportedVersion] = await Promise.all([
    prisma.businessCalendarVersion.findFirst({
      where: { calendarId: calendar.id },
      orderBy: { version: "desc" },
    }),
    prisma.businessCalendarVersion.findFirst({
      where: { calendarId: calendar.id, source: "imported" },
      orderBy: { version: "desc" },
    }),
  ]);

  if (
    latestImportedVersion &&
    calendarVersionContentEquals(
      {
        timezone: latestImportedVersion.timezone,
        weekly: latestImportedVersion.weekly as unknown as WeeklyWindow[],
        holidays: latestImportedVersion.holidays,
      },
      desired,
    )
  ) {
    return { id: latestImportedVersion.id, created: false };
  }

  const created = await prisma.businessCalendarVersion.create({
    data: {
      calendarId: calendar.id,
      version: (latestVersion?.version ?? 0) + 1,
      timezone: desired.timezone,
      weekly: desired.weekly as unknown as Prisma.InputJsonValue,
      holidays: desired.holidays,
      holidayNames: holidayNames as unknown as Prisma.InputJsonValue,
      alwaysOpen: false,
      source: "imported",
    },
  });
  return { id: created.id, created: true };
}

/** Keeps, per Zendesk schedule id, the most-recently-fetched holiday snapshot. */
function latestHolidaysByScheduleId(
  rows: { payload: unknown; fetchedAt: Date }[],
): Map<number, ZendeskScheduleHoliday[]> {
  const byScheduleId = new Map<number, { holidays: ZendeskScheduleHoliday[]; fetchedAt: Date }>();
  for (const row of rows) {
    const snapshot = row.payload as ScheduleHolidaysSnapshot;
    const existing = byScheduleId.get(snapshot.scheduleId);
    if (!existing || row.fetchedAt >= existing.fetchedAt) {
      byScheduleId.set(snapshot.scheduleId, { holidays: snapshot.holidays, fetchedAt: row.fetchedAt });
    }
  }
  return new Map([...byScheduleId.entries()].map(([id, { holidays }]) => [id, holidays]));
}

export interface BusinessCalendarImportResult {
  schedulesEvaluated: number;
  calendarVersionsCreated: number;
  /** Schedules skipped because Zendesk's `time_zone` couldn't be normalized to a canonical IANA id (4g) — never guessed at; the schedule's existing calendar (if any) is left untouched. */
  schedulesWithUnresolvedTimeZone: number;
}

/**
 * `RawEvent` (business_hours_schedule / schedule_holidays snapshots) ->
 * `BusinessCalendar`/`BusinessCalendarVersion`, one calendar per Zendesk
 * schedule (identified by `externalId`). Idempotent like the SLA policy
 * import: a re-run only creates a new version when a schedule's hours,
 * timezone, or holidays actually changed. Existing commitments keep the
 * calendar version bound at creation time (append-only versioning) — only
 * new commitments pick up a changed schedule.
 */
export async function runZendeskBusinessCalendarImport(
  prisma: PrismaClient,
  integrationId: string,
): Promise<BusinessCalendarImportResult> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const organizationId = integration.organizationId;

  const result: BusinessCalendarImportResult = {
    schedulesEvaluated: 0,
    calendarVersionsCreated: 0,
    schedulesWithUnresolvedTimeZone: 0,
  };

  const [scheduleRows, holidayRows] = await Promise.all([
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "business_hours_schedule:" } },
      select: { payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "schedule_holidays:" } },
      select: { payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
  ]);

  const latestSchedules = new Map<number, ZendeskBusinessHoursSchedule>();
  for (const row of scheduleRows) {
    const schedule = row.payload as ZendeskBusinessHoursSchedule;
    latestSchedules.set(schedule.id, schedule);
  }
  if (latestSchedules.size === 0) return result;

  const holidaysByScheduleId = latestHolidaysByScheduleId(holidayRows);

  for (const schedule of latestSchedules.values()) {
    result.schedulesEvaluated += 1;

    // 4g: never import a schedule under a timezone we can't map to a
    // canonical IANA id — that would silently break every later deadline
    // computed against it. Skip it (leaving any existing calendar version
    // untouched) and count it instead of guessing.
    const timeZone = normalizeZendeskTimeZone(schedule.time_zone);
    if (!timeZone) {
      result.schedulesWithUnresolvedTimeZone += 1;
      continue;
    }

    const holidays = holidaysByScheduleId.get(schedule.id) ?? [];
    const holidayDates = expandHolidayDates(holidays);
    const holidayNames = expandHolidayNames(holidays);
    const { created } = await ensureScheduleCalendarVersion(
      prisma,
      organizationId,
      { ...schedule, time_zone: timeZone },
      holidayDates,
      holidayNames,
    );
    if (created) result.calendarVersionsCreated += 1;
  }

  return result;
}

/** Latest `BusinessCalendarVersion` for each imported Zendesk schedule, keyed by the schedule's numeric id — for resolving `SLAPolicy.schedule_id`. */
export async function latestCalendarVersionsByZendeskScheduleId(
  prisma: PrismaClient,
  organizationId: string,
): Promise<Map<number, { id: string }>> {
  const calendars = await prisma.businessCalendar.findMany({
    where: { organizationId, externalId: { not: null } },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const map = new Map<number, { id: string }>();
  for (const calendar of calendars) {
    const version = calendar.versions[0];
    if (calendar.externalId && version) map.set(Number(calendar.externalId), { id: version.id });
  }
  return map;
}
