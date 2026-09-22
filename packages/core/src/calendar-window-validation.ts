import type { WeeklyWindow } from "./types";

export const MINUTES_PER_DAY = 24 * 60;

/**
 * Thrown by `validateWeeklyWindows` — a plain Error subclass (not a
 * framework-specific validation error) since `packages/core` has zero
 * framework dependencies; callers at each boundary (the API's
 * `ValidationError`, the native-calendar domain layer) catch this and
 * translate it into their own error type.
 */
export class WeeklyWindowValidationError extends Error {}

/**
 * The one canonical rule for what a `weekly` array may contain (4f) — used at
 * every boundary that accepts calendar hours (the API/domain layer in
 * `packages/commitments`, and the calendar editor's own client-side check)
 * so none of them can accept a shape another rejects.
 *
 * - `day` is an integer 0-6.
 * - `openMinute`/`closeMinute` are integers (no fractional minutes).
 * - `0 <= openMinute < closeMinute <= 1440` — `closeMinute: 1440` is the
 *   canonical way to express a window that runs to midnight (4e); a window is
 *   never allowed to cross into the next calendar day (a second entry on the
 *   next `day` represents that instead), matching how `computeDeadline`/
 *   `workingMinutesBetween` already attribute a window to exactly one weekday.
 * - No two windows on the same day may overlap (4f) — `computeDeadline` and
 *   `workingMinutesBetween` disagree on overlapping windows (the former
 *   dedupes via its forward-moving cursor, the latter double-counts), so
 *   overlap is rejected here rather than given a new, doubly-interpreted
 *   meaning.
 */
export function validateWeeklyWindows(weekly: WeeklyWindow[]): void {
  for (const w of weekly) {
    if (typeof w.day !== "number" || !Number.isInteger(w.day) || w.day < 0 || w.day > 6) {
      throw new WeeklyWindowValidationError("each weekly window needs an integer day between 0 and 6");
    }
    if (typeof w.openMinute !== "number" || !Number.isInteger(w.openMinute)) {
      throw new WeeklyWindowValidationError("openMinute must be a whole number of minutes");
    }
    if (typeof w.closeMinute !== "number" || !Number.isInteger(w.closeMinute)) {
      throw new WeeklyWindowValidationError("closeMinute must be a whole number of minutes");
    }
    if (w.openMinute < 0 || w.openMinute >= MINUTES_PER_DAY) {
      throw new WeeklyWindowValidationError("openMinute must be between 00:00 and 23:59");
    }
    if (w.closeMinute <= w.openMinute || w.closeMinute > MINUTES_PER_DAY) {
      throw new WeeklyWindowValidationError(
        "closeMinute must be after openMinute and no later than midnight (1440) — a window can't cross into the next day",
      );
    }
  }

  const byDay = new Map<number, WeeklyWindow[]>();
  for (const w of weekly) {
    const bucket = byDay.get(w.day);
    if (bucket) bucket.push(w);
    else byDay.set(w.day, [w]);
  }
  for (const windows of byDay.values()) {
    const sorted = [...windows].sort((a, b) => a.openMinute - b.openMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.openMinute < sorted[i - 1]!.closeMinute) {
        throw new WeeklyWindowValidationError("weekly windows on the same day must not overlap");
      }
    }
  }
}
