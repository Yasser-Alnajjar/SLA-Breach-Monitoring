import { isValidTimeZone, validateWeeklyWindows, WeeklyWindowValidationError, type WeeklyWindow } from "@sla/core";
import type { NativeHolidayInput } from "@sla/commitments";
import { ValidationError } from "./sla-policy-validation";

export { isValidTimeZone };

export function parseTimezone(raw: unknown): string {
  if (typeof raw !== "string" || !isValidTimeZone(raw)) {
    throw new ValidationError("timezone must be a valid IANA time zone name");
  }
  return raw;
}

/** Structural parsing only (shape/types) — the canonical business rule (bounds, no fractional minutes, no overlap) is `validateWeeklyWindows` from `@sla/core`, applied right after, so this boundary and the domain layer (`packages/commitments`'s native-calendar.ts) can never disagree on what's valid. */
export function parseWeekly(raw: unknown): WeeklyWindow[] {
  if (!Array.isArray(raw)) throw new ValidationError("weekly must be an array");
  const weekly = raw.map((window) => {
    const w = window as { day?: unknown; openMinute?: unknown; closeMinute?: unknown };
    if (typeof w.day !== "number" || typeof w.openMinute !== "number" || typeof w.closeMinute !== "number") {
      throw new ValidationError("each weekly window needs day, openMinute, and closeMinute (numbers)");
    }
    return { day: w.day as WeeklyWindow["day"], openMinute: w.openMinute, closeMinute: w.closeMinute };
  });
  try {
    validateWeeklyWindows(weekly);
  } catch (error) {
    if (error instanceof WeeklyWindowValidationError) throw new ValidationError(error.message);
    throw error;
  }
  return weekly;
}

const ONE_OFF_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RECURRING_DATE = /^\d{2}-\d{2}$/;

export function parseHolidays(raw: unknown): NativeHolidayInput[] {
  if (!Array.isArray(raw)) throw new ValidationError("holidays must be an array");
  return raw.map((holiday) => {
    const h = holiday as { date?: unknown; name?: unknown; recurring?: unknown };
    if (typeof h.date !== "string" || typeof h.name !== "string" || typeof h.recurring !== "boolean") {
      throw new ValidationError("each holiday needs date, name, and recurring");
    }
    const pattern = h.recurring ? RECURRING_DATE : ONE_OFF_DATE;
    if (!pattern.test(h.date)) {
      throw new ValidationError(
        h.recurring ? "a recurring holiday's date must be MM-DD" : "a one-off holiday's date must be YYYY-MM-DD",
      );
    }
    return { date: h.date, name: h.name, recurring: h.recurring };
  });
}
