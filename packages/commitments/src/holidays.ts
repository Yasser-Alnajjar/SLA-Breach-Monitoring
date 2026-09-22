/** How many years ahead a recurring holiday is expanded into concrete dates (task 4.6) — bounded, like the engine's own `MAX_DAYS_SEARCHED` (packages/core/src/calendar.ts). */
export const HOLIDAY_EXPANSION_YEARS_AHEAD = 5;

export interface NativeHolidayInput {
  /** `"YYYY-MM-DD"` for a one-off holiday, or `"MM-DD"` for a recurring one. */
  date: string;
  name: string;
  recurring: boolean;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Expands the calendar editor's holiday inputs into the flat `holidays`
 * date list and `holidayNames` map the schema stores — the SLA engine
 * (`packages/core`) only ever sees concrete dates, never a recurrence
 * concept, per the roadmap's explicit requirement. A recurring holiday is
 * expanded annually from `fromYear` through `fromYear + yearsAhead`
 * inclusive, so a calendar edited today keeps working without another edit
 * for `yearsAhead` years. A non-recurring holiday is kept as-is.
 */
export function expandNativeHolidays(
  holidays: NativeHolidayInput[],
  { fromYear = new Date().getUTCFullYear(), yearsAhead = HOLIDAY_EXPANSION_YEARS_AHEAD } = {},
): { holidays: string[]; holidayNames: Record<string, string> } {
  const dates = new Set<string>();
  const names: Record<string, string> = {};

  for (const holiday of holidays) {
    if (!holiday.recurring) {
      dates.add(holiday.date);
      names[holiday.date] = holiday.name;
      continue;
    }
    const [, , month, day] = /^(\d{4}-)?(\d{2})-(\d{2})$/.exec(holiday.date) ?? [];
    if (!month || !day) continue;
    for (let year = fromYear; year <= fromYear + yearsAhead; year += 1) {
      const date = isoDate(new Date(Date.UTC(year, Number(month) - 1, Number(day))));
      dates.add(date);
      names[date] = holiday.name;
    }
  }

  return { holidays: [...dates].sort(), holidayNames: names };
}
