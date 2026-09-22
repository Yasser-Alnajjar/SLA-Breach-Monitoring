import type { WeeklyWindow } from "./types";

export interface CalendarVersionContent {
  timezone: string;
  weekly: WeeklyWindow[];
  holidays: string[];
}

function normalizeWeekly(weekly: WeeklyWindow[]) {
  return [...weekly].sort((a, b) => a.day - b.day || a.openMinute - b.openMinute);
}

/**
 * Whether a newly-derived calendar version would be identical to the
 * current one, so writing one never creates a no-op version. Shared by the
 * Zendesk business-hours importer and the native calendar editor (Phase 4
 * task 4.5/4.6) — both append to the same `BusinessCalendarVersion` history
 * and must agree on what counts as "unchanged." Deliberately mirrors
 * `policyVersionContentEquals` (./policy-versions.ts).
 */
export function calendarVersionContentEquals(
  existing: CalendarVersionContent,
  desired: CalendarVersionContent,
): boolean {
  return (
    existing.timezone === desired.timezone &&
    JSON.stringify(normalizeWeekly(existing.weekly)) === JSON.stringify(normalizeWeekly(desired.weekly)) &&
    JSON.stringify([...existing.holidays].sort()) === JSON.stringify([...desired.holidays].sort())
  );
}
