import { describe, expect, it } from "vitest";
import type { BusinessCalendarVersion, Commitment, NormalizedEvent, SLAPolicyVersion } from "@sla/core";
import { bucketBreachesByDay, findBreachesInPeriod, summarizeCompliance } from "../src/lib/analytics-data";

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

describe("findBreachesInPeriod + bucketBreachesByDay (Breaches Over Time)", () => {
  const calendar: BusinessCalendarVersion = {
    id: "cal",
    version: 1,
    timezone: "UTC",
    weekly: [],
    holidays: [],
    alwaysOpen: true,
  };
  const policy: SLAPolicyVersion = {
    id: "pv",
    policyId: "p",
    version: 1,
    match: {},
    targets: [
      { kind: "first_response", minutes: 60 },
      { kind: "resolution", minutes: 60 },
    ],
    pauseOnStates: ["pending_customer"],
    calendarVersionId: "cal",
    warnAtPercent: [50, 80, 95],
    effectiveFrom: "2026-01-01T00:00:00.000Z",
  };
  const policies = new Map([[policy.id, policy]]);
  const calendars = new Map([[calendar.id, calendar]]);

  // The reconciliation run that first evaluated every historical commitment.
  const reconciledAt = new Date("2026-09-16T23:14:25.556Z");
  const periodStart = new Date("2026-09-08T00:00:00.000Z");

  /** A case opened at `startedAt` with a 60-minute first-response commitment, optionally closed at `closedAt`. */
  function historicalCase(name: string, startedAt: string, closedAt?: string, targetMinutes = 60) {
    const commitment: Commitment = {
      id: `commitment-${name}`,
      caseId: `case-${name}`,
      kind: "first_response",
      cycleKey: "single",
      policyVersionId: policy.id,
      calendarVersionId: calendar.id,
      startedAt,
      targetMinutes,
      dueAt: startedAt,
      status: "breached",
      // Where the worker stamped it, not when the case really closed.
      closedAt: closedAt ? reconciledAt.toISOString() : undefined,
    };
    const events: NormalizedEvent[] = [
      {
        id: `${name}-created`,
        caseId: commitment.caseId,
        type: "case_created",
        occurredAt: startedAt,
        actor: "customer",
        system: "zendesk",
        fromState: null,
        toState: "open",
        sourceRawEventId: `${name}-raw-1`,
      },
    ];
    if (closedAt) {
      events.push({
        id: `${name}-closed`,
        caseId: commitment.caseId,
        type: "case_closed",
        occurredAt: closedAt,
        actor: "agent",
        system: "zendesk",
        fromState: "open",
        toState: "resolved",
        sourceRawEventId: `${name}-raw-2`,
      });
    }
    return { commitment, events, caseOpenedAt: new Date(startedAt) };
  }

  function chartFor(cases: ReturnType<typeof historicalCase>[], asOf: Date, from = periodStart) {
    const breaches = findBreachesInPeriod(
      cases.map(({ commitment, caseOpenedAt }) => ({ commitment, caseOpenedAt })),
      new Map(cases.map((c) => [c.commitment.caseId, c.events])),
      policies,
      calendars,
      from,
      asOf,
    );
    const points = bucketBreachesByDay(breaches.map((b) => b.breachedAt), from, asOf);
    return { breaches, nonZero: points.filter((p) => p.count > 0) };
  }

  it("plots a breach discovered days later on the day it actually happened", () => {
    const { breaches, nonZero } = chartFor(
      [historicalCase("22", "2026-09-09T22:44:30.000Z", "2026-09-15T23:21:00.000Z")],
      reconciledAt,
    );
    expect(breaches.map((b) => b.breachedAt.toISOString())).toEqual(["2026-09-09T23:44:30.000Z"]);
    expect(nonZero).toEqual([{ date: "2026-09-09", count: 1 }]);
  });

  it("spreads breaches reconciled in the same run across their own dates", () => {
    const { nonZero } = chartFor(
      [
        historicalCase("22", "2026-09-09T22:44:30.000Z", "2026-09-15T23:21:00.000Z"),
        historicalCase("23", "2026-09-11T13:58:38.000Z", "2026-09-15T23:21:00.000Z"),
        historicalCase("34", "2026-09-12T09:16:33.000Z", "2026-09-16T09:49:00.000Z", 30),
        historicalCase("40", "2026-09-13T10:27:40.000Z", "2026-09-13T20:17:00.000Z"),
      ],
      reconciledAt,
    );
    expect(nonZero).toEqual([
      { date: "2026-09-09", count: 1 },
      { date: "2026-09-11", count: 1 },
      { date: "2026-09-12", count: 1 },
      { date: "2026-09-13", count: 1 },
    ]);
  });

  it("aggregates several breaches on the same date", () => {
    const { nonZero } = chartFor(
      [
        historicalCase("28", "2026-09-11T22:37:58.000Z", "2026-09-16T08:43:00.000Z"),
        historicalCase("a", "2026-09-11T01:00:00.000Z"),
        historicalCase("b", "2026-09-11T12:00:00.000Z", "2026-09-12T00:00:00.000Z"),
      ],
      reconciledAt,
    );
    expect(nonZero).toEqual([{ date: "2026-09-11", count: 3 }]);
  });

  it("doesn't count a met commitment", () => {
    // D5: a reply-less close is never "met", so this case needs an actual
    // agent reply inside the target to be a genuine met commitment.
    const metCase = historicalCase("met", "2026-09-10T08:00:00.000Z", "2026-09-10T08:45:00.000Z");
    metCase.events.push({
      id: "met-reply",
      caseId: metCase.commitment.caseId,
      type: "agent_replied",
      occurredAt: "2026-09-10T08:30:00.000Z",
      actor: "agent",
      system: "zendesk",
      fromState: null,
      toState: null,
      sourceRawEventId: "met-raw-reply",
    });
    const { breaches, nonZero } = chartFor([metCase], reconciledAt);
    expect(breaches).toEqual([]);
    expect(nonZero).toEqual([]);
  });

  it("doesn't count a reply-less close inside the target as met either (D5)", () => {
    const { breaches } = chartFor(
      [historicalCase("reply-less", "2026-09-10T08:00:00.000Z", "2026-09-10T08:45:00.000Z")],
      reconciledAt,
    );
    // Closed at 45m, inside the 60m target, but never actually replied to:
    // D5 says that's a broken promise, so it counts as a breach.
    expect(breaches).toHaveLength(1);
  });

  it("buckets a breach just before midnight on that day, and one just after on the next", () => {
    // Deadlines 23:59:30 and 00:00:30 UTC; the dashboard buckets by UTC day.
    const { nonZero } = chartFor(
      [
        historicalCase("before", "2026-09-13T22:59:30.000Z"),
        historicalCase("after", "2026-09-13T23:00:30.000Z"),
      ],
      reconciledAt,
    );
    expect(nonZero).toEqual([
      { date: "2026-09-13", count: 1 },
      { date: "2026-09-14", count: 1 },
    ]);
  });

  function withPendingPause(c: ReturnType<typeof historicalCase>) {
    c.events.push(
      {
        id: "paused-pending",
        caseId: c.commitment.caseId,
        type: "state_changed",
        occurredAt: "2026-09-13T22:30:00.000Z",
        actor: "agent",
        system: "zendesk",
        fromState: "open",
        toState: "pending_customer",
        sourceRawEventId: "paused-raw-2",
      },
      {
        id: "paused-reply",
        caseId: c.commitment.caseId,
        type: "state_changed",
        occurredAt: "2026-09-14T02:00:00.000Z",
        actor: "customer",
        system: "zendesk",
        fromState: "pending_customer",
        toState: "open",
        sourceRawEventId: "paused-raw-3",
      },
    );
    return c;
  }

  it("places a paused resolution commitment's breach after the pause", () => {
    const paused = withPendingPause(historicalCase("paused", "2026-09-13T22:00:00.000Z"));
    paused.commitment.kind = "resolution";
    const { breaches, nonZero } = chartFor([paused], reconciledAt);
    // Without the pause it would breach 2026-09-13 23:00.
    expect(breaches.map((b) => b.breachedAt.toISOString())).toEqual(["2026-09-14T02:30:00.000Z"]);
    expect(nonZero).toEqual([{ date: "2026-09-14", count: 1 }]);
  });

  it("does not move a first-response breach for a Pending pause", () => {
    const pendingFirstResponse = withPendingPause(historicalCase("paused", "2026-09-13T22:00:00.000Z"));
    const { breaches, nonZero } = chartFor([pendingFirstResponse], reconciledAt);
    expect(breaches.map((b) => b.breachedAt.toISOString())).toEqual(["2026-09-13T23:00:00.000Z"]);
    expect(nonZero).toEqual([{ date: "2026-09-13", count: 1 }]);
  });

  it("doesn't move historical breaches when reconciliation runs again later", () => {
    const cases = [
      historicalCase("22", "2026-09-09T22:44:30.000Z", "2026-09-15T23:21:00.000Z"),
      historicalCase("41", "2026-09-13T20:37:04.000Z", undefined, 30),
    ];
    const first = chartFor(cases, reconciledAt);
    const rerun = chartFor(cases, new Date("2026-09-20T06:00:00.000Z"));

    expect(rerun.breaches.map((b) => b.breachedAt.toISOString())).toEqual(
      first.breaches.map((b) => b.breachedAt.toISOString()),
    );
    expect(rerun.nonZero).toEqual(first.nonZero);
    expect(first.nonZero).toEqual([
      { date: "2026-09-09", count: 1 },
      { date: "2026-09-13", count: 1 },
    ]);
  });

  it("leaves out breaches that happened before the period, even if reconciled inside it", () => {
    const { breaches } = chartFor(
      [historicalCase("old", "2026-09-07T00:58:42.000Z", "2026-09-10T00:00:00.000Z")],
      reconciledAt,
    );
    expect(breaches).toEqual([]);
  });
});
