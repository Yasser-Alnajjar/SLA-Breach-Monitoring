import { describe, expect, it } from "vitest";
import { validateWeeklyWindows, WeeklyWindowValidationError } from "../src/calendar-window-validation";
import type { WeeklyWindow } from "../src/types";

function win(overrides: Partial<WeeklyWindow>): WeeklyWindow {
  return { day: 1, openMinute: 9 * 60, closeMinute: 17 * 60, ...overrides };
}

describe("validateWeeklyWindows", () => {
  it("accepts an empty array", () => {
    expect(() => validateWeeklyWindows([])).not.toThrow();
  });

  it("accepts non-overlapping windows across different days", () => {
    expect(() =>
      validateWeeklyWindows([win({ day: 1 }), win({ day: 2 }), win({ day: 3 })]),
    ).not.toThrow();
  });

  it("accepts back-to-back (touching) windows on the same day", () => {
    expect(() =>
      validateWeeklyWindows([
        win({ day: 1, openMinute: 9 * 60, closeMinute: 12 * 60 }),
        win({ day: 1, openMinute: 12 * 60, closeMinute: 17 * 60 }),
      ]),
    ).not.toThrow();
  });

  it("accepts a full 24-hour window (closeMinute: 1440)", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: 0, closeMinute: 1440 })])).not.toThrow();
  });

  it.each([-1, 7, 1.5, "1" as unknown as number])("rejects an invalid day (%p)", (day) => {
    expect(() => validateWeeklyWindows([win({ day: day as WeeklyWindow["day"] })])).toThrow(
      WeeklyWindowValidationError,
    );
  });

  it("rejects a fractional openMinute", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: 90.5 })])).toThrow(WeeklyWindowValidationError);
  });

  it("rejects a fractional closeMinute", () => {
    expect(() => validateWeeklyWindows([win({ closeMinute: 1020.25 })])).toThrow(WeeklyWindowValidationError);
  });

  it("rejects closeMinute <= openMinute (including a zero-length window)", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: 540, closeMinute: 540 })])).toThrow(
      WeeklyWindowValidationError,
    );
    expect(() => validateWeeklyWindows([win({ openMinute: 540, closeMinute: 500 })])).toThrow(
      WeeklyWindowValidationError,
    );
  });

  it("rejects closeMinute beyond midnight — no cross-midnight window", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: 1380, closeMinute: 1500 })])).toThrow(
      WeeklyWindowValidationError,
    );
  });

  it("rejects a negative openMinute", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: -30 })])).toThrow(WeeklyWindowValidationError);
  });

  it("rejects an openMinute at or past midnight", () => {
    expect(() => validateWeeklyWindows([win({ openMinute: 1440, closeMinute: 1440 })])).toThrow(
      WeeklyWindowValidationError,
    );
  });

  it("rejects overlapping windows on the same day", () => {
    expect(() =>
      validateWeeklyWindows([
        win({ day: 1, openMinute: 9 * 60, closeMinute: 17 * 60 }),
        win({ day: 1, openMinute: 12 * 60, closeMinute: 20 * 60 }),
      ]),
    ).toThrow(WeeklyWindowValidationError);
  });

  it("rejects overlapping windows regardless of input order", () => {
    expect(() =>
      validateWeeklyWindows([
        win({ day: 1, openMinute: 12 * 60, closeMinute: 20 * 60 }),
        win({ day: 1, openMinute: 9 * 60, closeMinute: 17 * 60 }),
      ]),
    ).toThrow(WeeklyWindowValidationError);
  });

  it("does not treat windows on different days as overlapping", () => {
    expect(() =>
      validateWeeklyWindows([win({ day: 1, openMinute: 0, closeMinute: 1440 }), win({ day: 2, openMinute: 0, closeMinute: 1440 })]),
    ).not.toThrow();
  });
});
