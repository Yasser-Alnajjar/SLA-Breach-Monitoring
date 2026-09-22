import type { Prisma, PrismaClient } from "@sla/db";
import { calendarVersionContentEquals, validateWeeklyWindows, WeeklyWindowValidationError, type WeeklyWindow } from "@sla/core";
import { expandNativeHolidays, type NativeHolidayInput } from "./holidays";
import { CalendarNotFoundError } from "./customer-calendar";

export { WeeklyWindowValidationError };

export interface CalendarFields {
  timezone: string;
  weekly: WeeklyWindow[];
  holidays: NativeHolidayInput[];
}

/**
 * The one non-empty rule (4b): a calendar that isn't Always Open must have
 * at least one working-hours window, or it has zero working time and every
 * deadline computed against it fails outright (`computeDeadline` exhausts
 * its search horizon). An Always Open calendar's `weekly` is never read by
 * the engine, so it may legitimately be empty. Never auto-fills default
 * hours — an empty schedule is rejected, not silently populated.
 */
function requireNonEmptyScheduleUnlessAlwaysOpen(weekly: WeeklyWindow[], alwaysOpen: boolean): void {
  if (!alwaysOpen && weekly.length === 0) {
    throw new WeeklyWindowValidationError(
      "a calendar needs at least one weekly working-hours window (unless it's Always Open)",
    );
  }
}

export interface CalendarVersionResult {
  calendarId: string;
  version: { id: string; version: number };
}

/**
 * Creates a native business calendar (task 4.6, D12) — the org-created
 * counterpart to an imported Zendesk schedule. Recurring holidays are
 * expanded into concrete dates here, at save time (`expandNativeHolidays`),
 * so the SLA engine (`packages/core`) only ever sees a flat date list.
 */
export async function createNativeCalendar(
  prisma: PrismaClient,
  organizationId: string,
  name: string,
  fields: CalendarFields,
): Promise<CalendarVersionResult> {
  validateWeeklyWindows(fields.weekly);
  requireNonEmptyScheduleUnlessAlwaysOpen(fields.weekly, false);
  const { holidays, holidayNames } = expandNativeHolidays(fields.holidays);

  const calendar = await prisma.businessCalendar.create({
    data: { organizationId, name, source: "native" },
  });
  const version = await prisma.businessCalendarVersion.create({
    data: {
      calendarId: calendar.id,
      version: 1,
      timezone: fields.timezone,
      weekly: fields.weekly as unknown as Prisma.InputJsonValue,
      holidays,
      holidayNames: holidayNames as unknown as Prisma.InputJsonValue,
      // 4h: the original recurring/one-off inputs, kept separately from the
      // flat expanded `holidays` above so reopening the editor can tell them
      // apart again instead of only ever seeing generated one-off dates.
      holidayDefinitions: fields.holidays as unknown as Prisma.InputJsonValue,
      alwaysOpen: false,
      source: "native",
    },
  });

  return {
    calendarId: calendar.id,
    version: { id: version.id, version: version.version },
  };
}

export interface UpdateCalendarInput {
  name?: string;
  timezone?: string;
  weekly?: WeeklyWindow[];
  holidays?: NativeHolidayInput[];
}

/**
 * Edits a calendar (task 4.6) — usable on **both** a native calendar and an
 * imported one: an owner can locally edit an imported Zendesk calendar's
 * hours, and per the E-18 fix (`ensureScheduleCalendarVersion`,
 * packages/zendesk) that edit is never clobbered by the next sync, since the
 * importer only ever compares against the latest *imported* version. Every
 * edit appends a new version — per D1b, this never touches an
 * already-created commitment (`Commitment.calendarVersionId` is frozen at
 * creation); only a later commitment picks up the new version. Fields not
 * given are carried over unchanged from the latest version. A submission
 * identical to the latest version is a no-op (`created: false`).
 */
export async function updateCalendar(
  prisma: PrismaClient,
  organizationId: string,
  calendarId: string,
  input: UpdateCalendarInput,
): Promise<CalendarVersionResult & { created: boolean }> {
  const calendar = await prisma.businessCalendar.findFirst({
    where: { id: calendarId, organizationId },
  });
  if (!calendar) throw new CalendarNotFoundError(calendarId);

  const latestVersion = await prisma.businessCalendarVersion.findFirst({
    where: { calendarId },
    orderBy: { version: "desc" },
  });
  if (!latestVersion) throw new CalendarNotFoundError(calendarId);

  if (input.name && input.name !== calendar.name) {
    await prisma.businessCalendar.update({
      where: { id: calendarId },
      data: { name: input.name },
    });
  }

  const desiredTimezone = input.timezone ?? latestVersion.timezone;
  const desiredWeekly = input.weekly ?? (latestVersion.weekly as unknown as WeeklyWindow[]);
  if (input.weekly) {
    validateWeeklyWindows(desiredWeekly);
    requireNonEmptyScheduleUnlessAlwaysOpen(desiredWeekly, latestVersion.alwaysOpen);
  }
  const { holidays: desiredHolidays, holidayNames: desiredHolidayNames } = input.holidays
    ? expandNativeHolidays(input.holidays)
    : { holidays: latestVersion.holidays, holidayNames: (latestVersion.holidayNames ?? {}) as Record<string, string> };
  // 4h: carried forward untouched when this edit doesn't touch holidays —
  // including staying null for a version that never had native-editor
  // holiday inputs (legacy or Zendesk-imported).
  const desiredHolidayDefinitions: NativeHolidayInput[] | null = input.holidays
    ? input.holidays
    : (latestVersion.holidayDefinitions as unknown as NativeHolidayInput[] | null);

  const unchanged =
    calendarVersionContentEquals(
      { timezone: latestVersion.timezone, weekly: latestVersion.weekly as unknown as WeeklyWindow[], holidays: latestVersion.holidays },
      { timezone: desiredTimezone, weekly: desiredWeekly, holidays: desiredHolidays },
    ) &&
    JSON.stringify(latestVersion.holidayNames ?? {}) === JSON.stringify(desiredHolidayNames) &&
    JSON.stringify(latestVersion.holidayDefinitions ?? null) === JSON.stringify(desiredHolidayDefinitions);

  if (unchanged) {
    return {
      created: false,
      calendarId,
      version: { id: latestVersion.id, version: latestVersion.version },
    };
  }

  const version = await prisma.businessCalendarVersion.create({
    data: {
      calendarId,
      version: latestVersion.version + 1,
      timezone: desiredTimezone,
      weekly: desiredWeekly as unknown as Prisma.InputJsonValue,
      holidays: desiredHolidays,
      holidayNames: desiredHolidayNames as unknown as Prisma.InputJsonValue,
      holidayDefinitions: desiredHolidayDefinitions as unknown as Prisma.InputJsonValue,
      alwaysOpen: latestVersion.alwaysOpen,
      source: calendar.source === "native" ? "native" : "override",
    },
  });

  return {
    created: true,
    calendarId,
    version: { id: version.id, version: version.version },
  };
}
