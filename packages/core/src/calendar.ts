import type { BusinessCalendarVersion } from "./types";

const DAY_MS = 24 * 60 * 60_000;
const MAX_DAYS_SEARCHED = 3650; // 10 years — guards against a misconfigured calendar with no open windows

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Constructing an Intl.DateTimeFormat is far more expensive than using one,
// and the day walk below formats several instants per day.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instantMs)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** The zone's UTC offset in effect at `instantMs` (local minus UTC, in ms). */
function offsetMs(instantMs: number, timeZone: string): number {
  const wholeSecondMs = Math.floor(instantMs / 1000) * 1000;
  const p = zonedParts(wholeSecondMs, timeZone);
  const localAsIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return localAsIfUtc - wholeSecondMs;
}

/**
 * Converts a local wall-clock time in `timeZone` to a UTC instant (ms).
 * Fields may overflow (`minute: 1440` is the next day's midnight), as with
 * `Date.UTC`.
 *
 * Exact across DST transitions, with two unavoidable choices for wall-clock
 * times that don't map to exactly one instant:
 * - A skipped time (spring-forward gap, e.g. 02:30 in New York on the
 *   transition day) resolves to the transition instant itself. The skipped
 *   wall-clock minutes never happened, so no working time accrues in them.
 * - A repeated time (fall-back overlap, e.g. 01:30) resolves to its first
 *   occurrence. A window boundary inside the repeated hour therefore counts
 *   from the earlier offset.
 * Both choices keep the mapping monotonic, so windows never invert.
 *
 * Assumes at most one offset change within a day either side of the target,
 * which holds for every IANA zone.
 */
function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetBefore = offsetMs(target - DAY_MS, timeZone);
  const offsetAfter = offsetMs(target + DAY_MS, timeZone);
  if (offsetBefore === offsetAfter) return target - offsetBefore;

  const earlier = Math.min(target - offsetBefore, target - offsetAfter);
  const later = Math.max(target - offsetBefore, target - offsetAfter);
  if (offsetMs(earlier, timeZone) === target - earlier) return earlier;
  if (offsetMs(later, timeZone) === target - later) return later;

  // Skipped time: binary-search the transition instant, which lies in
  // (earlier, later] and is the first instant carrying the post-transition
  // offset.
  let lo = earlier;
  let hi = later;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (offsetMs(mid, timeZone) === offsetAfter) hi = mid;
    else lo = mid;
  }
  return hi;
}

interface LocalDay {
  key: string; // "YYYY-MM-DD", matched against `holidays`
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  /** UTC instant (ms) of a wall-clock minute-of-day; 1440 is the next midnight. */
  at: (minuteOfDay: number) => number;
}

/**
 * The local calendar day `dayOffset` days after `anchor`'s. Days are stepped by calendar date, never by adding 24h, so a
 * 23- or 25-hour DST day is neither skipped nor visited twice.
 */
function localDay(
  anchor: ZonedParts,
  dayOffset: number,
  timeZone: string,
): LocalDay {
  const date = new Date(
    Date.UTC(anchor.year, anchor.month - 1, anchor.day + dayOffset),
  );
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return {
    key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    weekday: date.getUTCDay() as LocalDay["weekday"],
    at: (minuteOfDay) =>
      zonedDateToUtc(year, month, day, 0, minuteOfDay, timeZone),
  };
}

/**
 * Walks forward from `startInstant`, accumulating only working minutes per
 * the calendar's weekly hours and holidays, until `targetMinutes` have
 * elapsed. Returns the resulting deadline instant.
 *
 * `alwaysOpen` is the 24/7 degenerate case — a single code path, not a
 * separate branch by policy type.
 */
export function computeDeadline(
  startInstant: Date | string,
  targetMinutes: number,
  calendar: BusinessCalendarVersion,
): Date {
  const start =
    typeof startInstant === "string" ? new Date(startInstant) : startInstant;

  if (calendar.alwaysOpen) {
    return new Date(start.getTime() + targetMinutes * 60_000);
  }

  let remaining = targetMinutes;
  let cursor = start.getTime();
  const anchor = zonedParts(cursor, calendar.timezone);

  for (let dayOffset = 0; dayOffset < MAX_DAYS_SEARCHED; dayOffset++) {
    const day = localDay(anchor, dayOffset, calendar.timezone);

    if (!calendar.holidays.includes(day.key)) {
      const windows = calendar.weekly
        .filter((w) => w.day === day.weekday)
        .sort((a, b) => a.openMinute - b.openMinute);
      for (const window of windows) {
        const windowOpenMs = day.at(window.openMinute);
        const windowCloseMs = day.at(window.closeMinute);
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

    cursor = Math.max(cursor, day.at(24 * 60));
  }

  throw new Error(
    "computeDeadline: exceeded search horizon — check calendar configuration (no open windows found?)",
  );
}

/**
 * Sums the working minutes that overlap [start, end) per the calendar.
 * The inverse companion to `computeDeadline`; `elapsed.ts` uses this to
 * intersect running intervals with working hours.
 */
export function workingMinutesBetween(
  start: Date,
  end: Date,
  calendar: BusinessCalendarVersion,
): number {
  if (end <= start) return 0;

  if (calendar.alwaysOpen) {
    return (end.getTime() - start.getTime()) / 60_000;
  }

  let total = 0;
  let cursor = start.getTime();
  const endMs = end.getTime();
  const anchor = zonedParts(cursor, calendar.timezone);

  for (
    let dayOffset = 0;
    dayOffset < MAX_DAYS_SEARCHED && cursor < endMs;
    dayOffset++
  ) {
    const day = localDay(anchor, dayOffset, calendar.timezone);

    if (!calendar.holidays.includes(day.key)) {
      for (const window of calendar.weekly.filter(
        (w) => w.day === day.weekday,
      )) {
        const segStart = Math.max(cursor, day.at(window.openMinute));
        const segEnd = Math.min(day.at(window.closeMinute), endMs);
        if (segEnd > segStart) total += (segEnd - segStart) / 60_000;
      }
    }

    cursor = day.at(24 * 60);
  }

  return total;
}
