import type { BusinessCalendarVersion } from "./types.js";

const DAY_MS = 24 * 60 * 60_000;
const MAX_DAYS_SEARCHED = 3650; // 10 years — guards against a misconfigured calendar with no open windows

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
}

const WEEKDAY_INDEX: Record<string, ZonedParts["weekday"]> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday ?? ""] ?? 0,
  };
}

/**
 * Converts a local wall-clock date+time in `timeZone` to a UTC instant.
 * Converges in two passes; this is not exact across a DST transition at
 * minute resolution, which is an accepted approximation for this pass.
 */
function zonedDateToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const parts = zonedParts(new Date(guess), timeZone);
    const guessAsIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    guess -= guessAsIfUtc - target;
  }
  return new Date(guess);
}

function dateKey(parts: ZonedParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function localMidnightUtcMs(parts: ZonedParts, timeZone: string): number {
  return zonedDateToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone).getTime();
}

/**
 * Walks forward from `startInstant`, accumulating only working minutes per
 * the calendar's weekly hours and holidays, until `targetMinutes` have
 * elapsed. Returns the resulting deadline instant.
 *
 * `alwaysOpen` is the 24/7 degenerate case — a single code path, not a
 * separate branch by policy type.
 */
export function computeDeadline(startInstant: Date | string, targetMinutes: number, calendar: BusinessCalendarVersion): Date {
  const start = typeof startInstant === "string" ? new Date(startInstant) : startInstant;

  if (calendar.alwaysOpen) {
    return new Date(start.getTime() + targetMinutes * 60_000);
  }

  let remaining = targetMinutes;
  let cursor = start.getTime();

  for (let dayOffset = 0; dayOffset < MAX_DAYS_SEARCHED; dayOffset++) {
    const parts = zonedParts(new Date(cursor), calendar.timezone);
    const midnightMs = localMidnightUtcMs(parts, calendar.timezone);
    const nextMidnightMs = midnightMs + DAY_MS;
    const isHoliday = calendar.holidays.includes(dateKey(parts));

    if (!isHoliday) {
      const windows = calendar.weekly.filter((w) => w.day === parts.weekday).sort((a, b) => a.openMinute - b.openMinute);
      for (const window of windows) {
        const windowOpenMs = midnightMs + window.openMinute * 60_000;
        const windowCloseMs = midnightMs + window.closeMinute * 60_000;
        const segStart = Math.max(cursor, windowOpenMs);
        if (windowCloseMs <= segStart) continue;
        const availableMinutes = (windowCloseMs - segStart) / 60_000;
        if (availableMinutes >= remaining) {
          return new Date(segStart + remaining * 60_000);
        }
        remaining -= availableMinutes;
        cursor = windowCloseMs;
      }
    }

    cursor = Math.max(cursor, nextMidnightMs);
  }

  throw new Error("computeDeadline: exceeded search horizon — check calendar configuration (no open windows found?)");
}

/**
 * Sums the working minutes that overlap [start, end) per the calendar.
 * The inverse companion to `computeDeadline`; `elapsed.ts` uses this to
 * intersect running intervals with working hours.
 */
export function workingMinutesBetween(start: Date, end: Date, calendar: BusinessCalendarVersion): number {
  if (end <= start) return 0;

  if (calendar.alwaysOpen) {
    return (end.getTime() - start.getTime()) / 60_000;
  }

  let total = 0;
  let cursor = start.getTime();
  const endMs = end.getTime();

  for (let dayOffset = 0; dayOffset < MAX_DAYS_SEARCHED && cursor < endMs; dayOffset++) {
    const parts = zonedParts(new Date(cursor), calendar.timezone);
    const midnightMs = localMidnightUtcMs(parts, calendar.timezone);
    const nextMidnightMs = midnightMs + DAY_MS;
    const isHoliday = calendar.holidays.includes(dateKey(parts));

    if (!isHoliday) {
      for (const window of calendar.weekly.filter((w) => w.day === parts.weekday)) {
        const windowOpenMs = midnightMs + window.openMinute * 60_000;
        const windowCloseMs = midnightMs + window.closeMinute * 60_000;
        const segStart = Math.max(cursor, windowOpenMs, start.getTime());
        const segEnd = Math.min(windowCloseMs, endMs);
        if (segEnd > segStart) total += (segEnd - segStart) / 60_000;
      }
    }

    cursor = nextMidnightMs;
  }

  return total;
}
