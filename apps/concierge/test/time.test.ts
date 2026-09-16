import { describe, expect, it } from "vitest";
import { formatMinutes, parseBusinessHours, parseDuration, parseTimestamp } from "../src/time";

describe("parseTimestamp", () => {
  it("keeps explicit offsets", () => {
    expect(parseTimestamp("2026-09-01T09:00:00Z", "America/New_York")).toBe("2026-09-01T09:00:00.000Z");
    expect(parseTimestamp("2026-09-01 09:00:00 +0200", "UTC")).toBe("2026-09-01T07:00:00.000Z");
    expect(parseTimestamp("2026-09-01T09:00:00.123-04:00", "UTC")).toBe("2026-09-01T13:00:00.000Z");
  });

  it("reads zone-less timestamps as wall-clock time in the export zone, across DST", () => {
    expect(parseTimestamp("2026-07-01 09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(parseTimestamp("2026-12-01 09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z");
  });

  it("reads Jira's export format, including 12 AM/PM", () => {
    expect(parseTimestamp("01/Sep/26 1:05 PM", "UTC")).toBe("2026-09-01T13:05:00.000Z");
    expect(parseTimestamp("01/Sep/26 12:00 AM", "UTC")).toBe("2026-09-01T00:00:00.000Z");
    expect(parseTimestamp("01/Sep/26 12:30 PM", "UTC")).toBe("2026-09-01T12:30:00.000Z");
    expect(parseTimestamp("1/sep/2026 14:00", "UTC")).toBe("2026-09-01T14:00:00.000Z");
  });

  it("rejects anything else instead of guessing", () => {
    expect(parseTimestamp("09/01/2026 09:00", "UTC")).toBeNull();
    expect(parseTimestamp("2026-02-30 09:00", "UTC")).toBeNull();
    expect(parseTimestamp("13/Sep/26 13:00 PM", "UTC")).toBeNull();
    expect(parseTimestamp("", "UTC")).toBeNull();
  });
});

describe("parseDuration", () => {
  it("reads minutes and d/h/m combinations", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("4h")).toBe(240);
    expect(parseDuration("1d4h30m")).toBe(1710);
    expect(parseDuration("2D")).toBe(2880);
  });

  it("rejects empty, zero and malformed values", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("0h")).toBeNull();
    expect(parseDuration("4 hours")).toBeNull();
  });
});

describe("parseBusinessHours", () => {
  it("expands day ranges, wrapping past Saturday", () => {
    expect(parseBusinessHours("mon-fri 09:00-17:00").map((w) => w.day)).toEqual([1, 2, 3, 4, 5]);
    expect(parseBusinessHours("fri-mon 10:00-14:00").map((w) => w.day)).toEqual([5, 6, 0, 1]);
    expect(parseBusinessHours("sat 10:00-14:30")).toEqual([{ day: 6, openMinute: 600, closeMinute: 870 }]);
  });

  it("rejects windows that don't close after they open", () => {
    expect(() => parseBusinessHours("mon 17:00-09:00")).toThrow(/close must be after open/);
    expect(() => parseBusinessHours("weekdays 09:00-17:00")).toThrow(/Expected/);
  });
});

describe("formatMinutes", () => {
  it("matches the web app's format", () => {
    expect(formatMinutes(1710)).toBe("1d 4h 30m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(-90)).toBe("-1h 30m");
  });
});
