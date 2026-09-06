import { describe, expect, it } from "vitest";
import {
  calendarVersionContentEquals,
  expandHolidayDates,
  intervalsToWeeklyWindows,
} from "../src/calendars";
import type { ZendeskScheduleHoliday } from "../src/types";

describe("intervalsToWeeklyWindows", () => {
  it("splits a Sunday-relative interval into day + minute-of-day", () => {
    // Monday 09:00-17:00: day 1 offset = 1*1440 + 9*60 = 1980, end = 1*1440 + 17*60 = 2460
    expect(intervalsToWeeklyWindows([{ start_time: 1980, end_time: 2460 }])).toEqual([
      { day: 1, openMinute: 540, closeMinute: 1020 },
    ]);
  });

  it("maps a Sunday interval to day 0", () => {
    expect(intervalsToWeeklyWindows([{ start_time: 0, end_time: 60 }])).toEqual([
      { day: 0, openMinute: 0, closeMinute: 60 },
    ]);
  });

  it("returns one window per interval, in order", () => {
    const windows = intervalsToWeeklyWindows([
      { start_time: 1980, end_time: 2460 }, // Mon 09:00-17:00
      { start_time: 3420, end_time: 3900 }, // Tue 09:00-17:00
    ]);
    expect(windows).toEqual([
      { day: 1, openMinute: 540, closeMinute: 1020 },
      { day: 2, openMinute: 540, closeMinute: 1020 },
    ]);
  });
});

describe("expandHolidayDates", () => {
  function holiday(overrides: Partial<ZendeskScheduleHoliday>): ZendeskScheduleHoliday {
    return { id: 1, name: "Holiday", start_date: "2026-12-25", end_date: "2026-12-25", ...overrides };
  }

  it("expands a single-day holiday to one date", () => {
    expect(expandHolidayDates([holiday({})])).toEqual(["2026-12-25"]);
  });

  it("expands a multi-day holiday range inclusively", () => {
    expect(expandHolidayDates([holiday({ start_date: "2026-12-24", end_date: "2026-12-26" })])).toEqual([
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
    ]);
  });

  it("dedupes and sorts across multiple holidays", () => {
    const dates = expandHolidayDates([
      holiday({ start_date: "2027-01-01", end_date: "2027-01-01" }),
      holiday({ start_date: "2026-12-25", end_date: "2026-12-26" }),
    ]);
    expect(dates).toEqual(["2026-12-25", "2026-12-26", "2027-01-01"]);
  });

  it("returns an empty array for no holidays", () => {
    expect(expandHolidayDates([])).toEqual([]);
  });
});

describe("calendarVersionContentEquals", () => {
  const base = {
    timezone: "America/New_York",
    weekly: [{ day: 1 as const, openMinute: 540, closeMinute: 1020 }],
    holidays: ["2026-12-25"],
  };

  it("is true for identical content", () => {
    expect(calendarVersionContentEquals(base, { ...base })).toBe(true);
  });

  it("ignores weekly/holiday ordering", () => {
    const reordered = {
      timezone: "America/New_York",
      weekly: [
        { day: 2 as const, openMinute: 540, closeMinute: 1020 },
        { day: 1 as const, openMinute: 540, closeMinute: 1020 },
      ],
      holidays: ["2027-01-01", "2026-12-25"],
    };
    const same = {
      timezone: "America/New_York",
      weekly: [
        { day: 1 as const, openMinute: 540, closeMinute: 1020 },
        { day: 2 as const, openMinute: 540, closeMinute: 1020 },
      ],
      holidays: ["2026-12-25", "2027-01-01"],
    };
    expect(calendarVersionContentEquals(reordered, same)).toBe(true);
  });

  it("is false when the timezone changed", () => {
    expect(calendarVersionContentEquals(base, { ...base, timezone: "UTC" })).toBe(false);
  });

  it("is false when a holiday was added", () => {
    expect(calendarVersionContentEquals(base, { ...base, holidays: [...base.holidays, "2027-01-01"] })).toBe(false);
  });
});
