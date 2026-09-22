import { describe, expect, it } from "vitest";
import { computeDeadline, type BusinessCalendarVersion } from "@sla/core";
import { isValidTimeZone, parseTimezone } from "@/lib/calendar-validation";
import {
  buildTimeZoneOptions,
  matchesTimeZoneQuery,
  supportedTimeZones,
  timeZoneOption,
} from "@/lib/timezones";

// A fixed instant so offsets are deterministic: 2026-01-15 is standard time
// in both hemispheres' northern zones (New York UTC-5, Cairo UTC+2).
const AT = new Date("2026-01-15T12:00:00Z");

function calendar(timezone: string): BusinessCalendarVersion {
  return {
    id: "calv_1",
    version: 1,
    timezone,
    weekly: [1, 2, 3, 4, 5].map((day) => ({
      day: day as 1 | 2 | 3 | 4 | 5,
      openMinute: 9 * 60,
      closeMinute: 17 * 60,
    })),
    holidays: [],
    alwaysOpen: false,
  };
}

describe("supportedTimeZones", () => {
  const zones = supportedTimeZones();

  it("is the runtime's full IANA list, not a hand-picked handful", () => {
    expect(zones.length).toBeGreaterThan(300);
    expect(new Set(zones).size).toBe(zones.length);
  });

  it("includes UTC, which Intl.supportedValuesOf omits", () => {
    expect(zones).toContain("UTC");
  });

  it("offers current IANA names instead of legacy CLDR spellings", () => {
    expect(zones).toContain("Asia/Kolkata");
    expect(zones).toContain("Europe/Kyiv");
    expect(zones).not.toContain("Asia/Calcutta");
    expect(zones).not.toContain("Europe/Kiev");
  });

  it("only offers values the calendar API will accept", () => {
    for (const zone of zones) {
      expect(isValidTimeZone(zone), zone).toBe(true);
      expect(parseTimezone(zone)).toBe(zone);
    }
  });

  it("only offers values the calendar engine can compute a deadline in", () => {
    for (const zone of zones) {
      expect(() => computeDeadline(AT, 60, calendar(zone)), zone).not.toThrow();
    }
  });
});

describe("timeZoneOption", () => {
  it("persists the canonical id and shows the offset in the label", () => {
    expect(timeZoneOption("Africa/Cairo", AT)).toMatchObject({
      value: "Africa/Cairo",
      label: "Africa/Cairo (GMT+02:00)",
      offset: "GMT+02:00",
      offsetMinutes: 120,
      valid: true,
    });
    expect(timeZoneOption("America/New_York", AT)).toMatchObject({
      value: "America/New_York",
      offset: "GMT-05:00",
      offsetMinutes: -300,
    });
  });

  it("normalizes a zero offset to GMT+00:00", () => {
    expect(timeZoneOption("UTC", AT).offset).toBe("GMT+00:00");
    expect(timeZoneOption("Europe/London", AT).offset).toBe("GMT+00:00");
  });

  it("handles half-hour offsets", () => {
    expect(timeZoneOption("Asia/Kolkata", AT)).toMatchObject({
      offset: "GMT+05:30",
      offsetMinutes: 330,
    });
  });

  it("marks a value Intl can't resolve as invalid instead of throwing", () => {
    expect(timeZoneOption("Eastern Time (US & Canada)", AT)).toMatchObject({
      value: "Eastern Time (US & Canada)",
      valid: false,
    });
  });
});

describe("buildTimeZoneOptions", () => {
  it("puts UTC first, then orders by offset", () => {
    const options = buildTimeZoneOptions(AT);
    expect(options[0]!.value).toBe("UTC");
    const offsets = options.slice(1).map((o) => o.offsetMinutes);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("keeps an already-stored value the runtime list doesn't contain", () => {
    const legacy = buildTimeZoneOptions(AT, "Asia/Calcutta");
    expect(legacy.find((o) => o.value === "Asia/Calcutta")).toMatchObject({ valid: true });

    const unrecognized = buildTimeZoneOptions(AT, "Not/AZone");
    expect(unrecognized.find((o) => o.value === "Not/AZone")).toMatchObject({ valid: false });
  });

  it("does not duplicate a stored value that is already listed", () => {
    const options = buildTimeZoneOptions(AT, "Africa/Cairo");
    expect(options.filter((o) => o.value === "Africa/Cairo")).toHaveLength(1);
  });
});

describe("matchesTimeZoneQuery", () => {
  const options = buildTimeZoneOptions(AT);
  const search = (query: string) =>
    options.filter((o) => matchesTimeZoneQuery(o, query)).map((o) => o.value);

  it("matches the IANA id with underscores and slashes read as spaces", () => {
    expect(search("new york")).toContain("America/New_York");
    expect(search("New_York")).toContain("America/New_York");
    expect(search("africa cairo")).toContain("Africa/Cairo");
  });

  it("matches the localized zone name", () => {
    expect(search("eastern standard")).toContain("America/New_York");
  });

  it("matches the offset", () => {
    expect(search("+05:30")).toContain("Asia/Kolkata");
    expect(search("gmt+2")).toContain("Africa/Cairo");
  });

  it("returns everything for an empty query", () => {
    expect(search("  ")).toHaveLength(options.length);
  });
});

describe("computeDeadline with a selected timezone", () => {
  it("anchors working hours to the selected zone's local time", () => {
    // Thu 2026-01-15 07:00Z = 09:00 in Cairo (UTC+2): one working hour ends 10:00 local = 08:00Z.
    expect(computeDeadline("2026-01-15T07:00:00Z", 60, calendar("Africa/Cairo")).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    // Same instant is 02:00 in New York: the clock waits for 09:00 local (14:00Z).
    expect(computeDeadline("2026-01-15T07:00:00Z", 60, calendar("America/New_York")).toISOString()).toBe(
      "2026-01-15T15:00:00.000Z",
    );
  });
});
