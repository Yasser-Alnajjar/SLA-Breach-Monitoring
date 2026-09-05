import { describe, expect, it } from "vitest";
import { computeElapsedWorkingMinutes } from "../src/elapsed.js";
import type { BusinessCalendarVersion, NormalizedEvent } from "../src/types.js";

const businessHours: BusinessCalendarVersion = {
  id: "cal-v1",
  version: 1,
  timezone: "UTC",
  weekly: [1, 2, 3, 4, 5].map((day) => ({
    day: day as 1 | 2 | 3 | 4 | 5,
    openMinute: 9 * 60,
    closeMinute: 17 * 60,
  })),
  holidays: [],
  alwaysOpen: false,
};

let seq = 0;
function event(
  partial: Partial<NormalizedEvent> &
    Pick<NormalizedEvent, "occurredAt" | "system" | "toState" | "type">,
): NormalizedEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    caseId: "case-1",
    actor: "agent",
    fromState: null,
    sourceRawEventId: `raw-${seq}`,
    ...partial,
  };
}

describe("computeElapsedWorkingMinutes", () => {
  it("returns the full window when there are zero pauses", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
    ];
    const result = computeElapsedWorkingMinutes(
      events,
      ["pending_customer"],
      businessHours,
      "2026-09-07T12:00:00.000Z",
    );
    expect(result.elapsedWorkingMinutes).toBe(180);
    expect(result.pausedIntervals).toHaveLength(0);
  });

  it("subtracts a single pause interval", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "open",
        toState: "pending_customer",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "pending_customer",
        toState: "open",
        occurredAt: "2026-09-07T13:00:00.000Z",
      }),
    ];
    const result = computeElapsedWorkingMinutes(
      events,
      ["pending_customer"],
      businessHours,
      "2026-09-07T15:00:00.000Z",
    );
    expect(result.elapsedWorkingMinutes).toBe(240); // [09-11) + [13-15)
    expect(result.pausedIntervals).toEqual([
      {
        start: "2026-09-07T11:00:00.000Z",
        end: "2026-09-07T13:00:00.000Z",
        cause: "pending_customer",
      },
    ]);
  });

  it("subtracts multiple pause intervals", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "open",
        toState: "pending_customer",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "pending_customer",
        toState: "open",
        occurredAt: "2026-09-07T13:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "open",
        toState: "pending_customer",
        occurredAt: "2026-09-07T15:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "pending_customer",
        toState: "open",
        occurredAt: "2026-09-07T16:00:00.000Z",
      }),
    ];
    const result = computeElapsedWorkingMinutes(
      events,
      ["pending_customer"],
      businessHours,
      "2026-09-07T17:00:00.000Z",
    );
    expect(result.elapsedWorkingMinutes).toBe(300); // [09-11) + [13-15) + [16-17)
    expect(result.pausedIntervals).toHaveLength(2);
  });

  it("does not pause the customer-facing clock on a non-customer state, even from the linked system (Phase 13.4)", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      // Jira-side internal block — not a customer-caused wait, must not pause the SLA clock.
      event({
        type: "state_changed",
        system: "jira",
        fromState: "in_progress",
        toState: "pending_internal",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "jira",
        fromState: "pending_internal",
        toState: "in_progress",
        occurredAt: "2026-09-07T12:00:00.000Z",
      }),
    ];
    const result = computeElapsedWorkingMinutes(
      events,
      ["pending_customer"],
      businessHours,
      "2026-09-07T13:00:00.000Z",
    );
    expect(result.elapsedWorkingMinutes).toBe(240); // continuous 09:00 -> 13:00, no pause
    expect(result.pausedIntervals).toHaveLength(0);
  });

  it("pauses on a customer-caused state regardless of which system reports it", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      // A linked Jira issue also observes the customer-wait state — still pauses.
      event({
        type: "state_changed",
        system: "jira",
        fromState: "in_progress",
        toState: "pending_customer",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "jira",
        fromState: "pending_customer",
        toState: "in_progress",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
    ];
    const result = computeElapsedWorkingMinutes(
      events,
      ["pending_customer"],
      businessHours,
      "2026-09-07T12:00:00.000Z",
    );
    expect(result.elapsedWorkingMinutes).toBe(120); // [09-10) + [11-12)
    expect(result.pausedIntervals).toHaveLength(1);
  });
});
