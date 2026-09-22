import { describe, expect, it } from "vitest";
import { expandNativeHolidays } from "../src/holidays";

describe("expandNativeHolidays", () => {
  it("keeps a non-recurring holiday as its exact date", () => {
    const result = expandNativeHolidays([
      { date: "2026-12-25", name: "Christmas", recurring: false },
    ]);

    expect(result.holidays).toEqual(["2026-12-25"]);
    expect(result.holidayNames).toEqual({ "2026-12-25": "Christmas" });
  });

  it("expands a recurring holiday across the configured window of years", () => {
    const result = expandNativeHolidays(
      [{ date: "01-01", name: "New Year's Day", recurring: true }],
      { fromYear: 2026, yearsAhead: 2 },
    );

    expect(result.holidays).toEqual(["2026-01-01", "2027-01-01", "2028-01-01"]);
    expect(result.holidayNames).toEqual({
      "2026-01-01": "New Year's Day",
      "2027-01-01": "New Year's Day",
      "2028-01-01": "New Year's Day",
    });
  });

  it("mixes recurring and non-recurring holidays", () => {
    const result = expandNativeHolidays(
      [
        { date: "12-25", name: "Christmas", recurring: true },
        { date: "2026-07-04", name: "One-off closure", recurring: false },
      ],
      { fromYear: 2026, yearsAhead: 1 },
    );

    expect(result.holidays).toEqual(["2026-07-04", "2026-12-25", "2027-12-25"]);
  });

  it("the engine only ever sees a flat date list — no recurrence concept survives expansion", () => {
    const result = expandNativeHolidays(
      [{ date: "03-17", name: "Founders Day", recurring: true }],
      { fromYear: 2026, yearsAhead: 3 },
    );

    for (const date of result.holidays) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("returns empty output for no holidays", () => {
    expect(expandNativeHolidays([])).toEqual({ holidays: [], holidayNames: {} });
  });
});
