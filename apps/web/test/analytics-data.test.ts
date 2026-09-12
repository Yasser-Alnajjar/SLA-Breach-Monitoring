import { describe, expect, it } from "vitest";
import { bucketBreachesByDay, summarizeCompliance } from "../src/lib/analytics-data";

describe("bucketBreachesByDay", () => {
  it("fills every day in range with 0 when there are no breaches", () => {
    const points = bucketBreachesByDay(
      [],
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-03T12:00:00.000Z"),
    );
    expect(points).toEqual([
      { date: "2026-09-01", count: 0 },
      { date: "2026-09-02", count: 0 },
      { date: "2026-09-03", count: 0 },
    ]);
  });

  it("groups multiple breaches on the same UTC day", () => {
    const points = bucketBreachesByDay(
      [
        new Date("2026-09-02T01:00:00.000Z"),
        new Date("2026-09-02T23:00:00.000Z"),
        new Date("2026-09-03T00:00:00.000Z"),
      ],
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-09-03T00:00:00.000Z"),
    );
    expect(points).toEqual([
      { date: "2026-09-01", count: 0 },
      { date: "2026-09-02", count: 2 },
      { date: "2026-09-03", count: 1 },
    ]);
  });
});

describe("summarizeCompliance", () => {
  it("counts a healthy case (on_track) as met SLA", () => {
    const result = summarizeCompliance([{ caseId: "c1", status: "on_track" }]);
    expect(result).toEqual({ metSla: 1, atRisk: 0, breached: 0, total: 1 });
  });

  it("picks the worst status across a case's commitments", () => {
    const result = summarizeCompliance([
      { caseId: "c1", status: "met" },
      { caseId: "c1", status: "breached" },
      { caseId: "c2", status: "on_track" },
      { caseId: "c2", status: "at_risk" },
    ]);
    expect(result).toEqual({ metSla: 0, atRisk: 1, breached: 1, total: 2 });
  });

  it("excludes cases whose only commitments are cancelled", () => {
    const result = summarizeCompliance([{ caseId: "c1", status: "cancelled" }]);
    expect(result).toEqual({ metSla: 0, atRisk: 0, breached: 0, total: 0 });
  });

  it("ignores a cancelled commitment on a case that also has a real status", () => {
    const result = summarizeCompliance([
      { caseId: "c1", status: "cancelled" },
      { caseId: "c1", status: "met" },
    ]);
    expect(result).toEqual({ metSla: 1, atRisk: 0, breached: 0, total: 1 });
  });
});
