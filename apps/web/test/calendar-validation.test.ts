import { describe, expect, it } from "vitest";
import { isValidTimeZone, parseHolidays, parseTimezone, parseWeekly } from "@/lib/calendar-validation";
import { ValidationError } from "@/lib/sla-policy-validation";

describe("parseTimezone", () => {
  it("accepts a valid IANA timezone", () => {
    expect(parseTimezone("Africa/Cairo")).toBe("Africa/Cairo");
  });

  it("rejects a non-string", () => {
    expect(() => parseTimezone(42)).toThrow(ValidationError);
  });

  it("rejects an invalid timezone name", () => {
    expect(() => parseTimezone("Not/AZone")).toThrow(ValidationError);
  });

  it("agrees with isValidTimeZone", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("parseWeekly", () => {
  it("rejects a non-array", () => {
    expect(() => parseWeekly("nope")).toThrow(ValidationError);
  });

  it("accepts an empty array (context-dependent — enforced elsewhere, 4b)", () => {
    expect(parseWeekly([])).toEqual([]);
  });

  it("accepts a valid window", () => {
    expect(parseWeekly([{ day: 1, openMinute: 540, closeMinute: 1020 }])).toEqual([
      { day: 1, openMinute: 540, closeMinute: 1020 },
    ]);
  });

  it("accepts a full 24-hour window (closeMinute: 1440) — 4e", () => {
    expect(parseWeekly([{ day: 1, openMinute: 0, closeMinute: 1440 }])).toEqual([
      { day: 1, openMinute: 0, closeMinute: 1440 },
    ]);
  });

  it("rejects a non-numeric field", () => {
    expect(() => parseWeekly([{ day: "1", openMinute: 540, closeMinute: 1020 }])).toThrow(ValidationError);
  });

  it("rejects an out-of-range day — 4f", () => {
    expect(() => parseWeekly([{ day: 7, openMinute: 540, closeMinute: 1020 }])).toThrow(ValidationError);
  });

  it("rejects a fractional minute — 4f", () => {
    expect(() => parseWeekly([{ day: 1, openMinute: 540.5, closeMinute: 1020 }])).toThrow(ValidationError);
  });

  it("rejects closeMinute past midnight — no cross-midnight window, 4f", () => {
    expect(() => parseWeekly([{ day: 1, openMinute: 1380, closeMinute: 1500 }])).toThrow(ValidationError);
  });

  it("rejects closeMinute <= openMinute — 4f", () => {
    expect(() => parseWeekly([{ day: 1, openMinute: 540, closeMinute: 540 }])).toThrow(ValidationError);
  });

  it("rejects overlapping windows on the same day — 4f", () => {
    expect(() =>
      parseWeekly([
        { day: 1, openMinute: 540, closeMinute: 1020 },
        { day: 1, openMinute: 900, closeMinute: 1080 },
      ]),
    ).toThrow(ValidationError);
  });

  it("accepts non-overlapping (including back-to-back) windows on the same day — 4c", () => {
    expect(
      parseWeekly([
        { day: 1, openMinute: 540, closeMinute: 720 },
        { day: 1, openMinute: 720, closeMinute: 1020 },
      ]),
    ).toHaveLength(2);
  });
});

describe("parseHolidays", () => {
  it("accepts a one-off holiday", () => {
    expect(parseHolidays([{ date: "2026-12-25", name: "Christmas", recurring: false }])).toEqual([
      { date: "2026-12-25", name: "Christmas", recurring: false },
    ]);
  });

  it("accepts a recurring holiday", () => {
    expect(parseHolidays([{ date: "12-25", name: "Christmas", recurring: true }])).toEqual([
      { date: "12-25", name: "Christmas", recurring: true },
    ]);
  });

  it("rejects a one-off holiday with an MM-DD date", () => {
    expect(() => parseHolidays([{ date: "12-25", name: "Christmas", recurring: false }])).toThrow(ValidationError);
  });

  it("rejects a recurring holiday with a YYYY-MM-DD date", () => {
    expect(() => parseHolidays([{ date: "2026-12-25", name: "Christmas", recurring: true }])).toThrow(
      ValidationError,
    );
  });

  it("rejects a non-array", () => {
    expect(() => parseHolidays("nope")).toThrow(ValidationError);
  });
});
