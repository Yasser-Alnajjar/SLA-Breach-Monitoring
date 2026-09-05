import { describe, expect, it } from "vitest";
import { formatJqlDateTime } from "../src/backfill";

describe("formatJqlDateTime", () => {
  it("formats as Jira's quoted JQL date-time literal, in UTC", () => {
    expect(formatJqlDateTime(new Date("2026-03-05T09:07:00.000Z"))).toBe("2026/03/05 09:07");
  });

  it("zero-pads single-digit month, day, hour, and minute", () => {
    expect(formatJqlDateTime(new Date("2026-01-02T03:04:00.000Z"))).toBe("2026/01/02 03:04");
  });
});
