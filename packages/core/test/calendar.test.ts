import { describe, expect, it } from "vitest";
import { computeDeadline, workingMinutesBetween } from "../src/calendar.js";
import type { BusinessCalendarVersion } from "../src/types.js";

const businessHours: BusinessCalendarVersion = {
  id: "cal-v1",
  version: 1,
  timezone: "UTC",
  weekly: [1, 2, 3, 4, 5].map((day) => ({ day: day as 1 | 2 | 3 | 4 | 5, openMinute: 9 * 60, closeMinute: 17 * 60 })),
  holidays: ["2026-09-09"], // Wednesday
  alwaysOpen: false,
};

const alwaysOpen: BusinessCalendarVersion = {
  id: "cal-24-7",
  version: 1,
  timezone: "UTC",
  weekly: [],
  holidays: [],
  alwaysOpen: true,
};

describe("computeDeadline", () => {
  it("carries remaining minutes across a weekend boundary", () => {
    // Friday 16:00 + 120 target minutes: 60 available before close, 60 more consumed Monday from open.
    const deadline = computeDeadline("2026-09-11T16:00:00.000Z", 120, businessHours);
    expect(deadline.toISOString()).toBe("2026-09-14T10:00:00.000Z");
  });

  it("skips a holiday entirely", () => {
    // Tuesday 16:00 + 120 target minutes: 60 available before close, Wednesday is a holiday, 60 more Thursday from open.
    const deadline = computeDeadline("2026-09-08T16:00:00.000Z", 120, businessHours);
    expect(deadline.toISOString()).toBe("2026-09-10T10:00:00.000Z");
  });

  it("treats alwaysOpen as a single 24/7 code path", () => {
    const deadline = computeDeadline("2026-09-11T16:00:00.000Z", 120, alwaysOpen);
    expect(deadline.toISOString()).toBe("2026-09-11T18:00:00.000Z");
  });

  it("resolves within the same working window when enough time remains", () => {
    const deadline = computeDeadline("2026-09-07T09:00:00.000Z", 60, businessHours);
    expect(deadline.toISOString()).toBe("2026-09-07T10:00:00.000Z");
  });
});

describe("workingMinutesBetween", () => {
  it("sums only working minutes, excluding a holiday and the weekend", () => {
    // Tue 16:00 -> Thu 10:00, holiday Wed skipped, weekend not in range.
    const minutes = workingMinutesBetween(new Date("2026-09-08T16:00:00.000Z"), new Date("2026-09-10T10:00:00.000Z"), businessHours);
    expect(minutes).toBe(120);
  });

  it("returns raw elapsed minutes for an alwaysOpen calendar", () => {
    const minutes = workingMinutesBetween(new Date("2026-09-11T16:00:00.000Z"), new Date("2026-09-11T18:00:00.000Z"), alwaysOpen);
    expect(minutes).toBe(120);
  });

  it("returns 0 when end is not after start", () => {
    const minutes = workingMinutesBetween(new Date("2026-09-07T09:00:00.000Z"), new Date("2026-09-07T09:00:00.000Z"), businessHours);
    expect(minutes).toBe(0);
  });
});
