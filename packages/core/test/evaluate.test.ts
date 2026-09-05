import { describe, expect, it } from "vitest";
import { evaluateCommitment } from "../src/evaluate.js";
import type {
  BusinessCalendarVersion,
  Commitment,
  NormalizedEvent,
  SLAPolicyVersion,
} from "../src/types";

const alwaysOpen: BusinessCalendarVersion = {
  id: "cal-24-7",
  version: 1,
  timezone: "UTC",
  weekly: [],
  holidays: [],
  alwaysOpen: true,
};

const policy: SLAPolicyVersion = {
  id: "policy-v1",
  policyId: "policy",
  version: 1,
  match: {},
  targets: [{ kind: "resolution", minutes: 240 }],
  pauseOnStates: [],
  calendarVersionId: alwaysOpen.id,
  warnAtPercent: [50, 80, 95],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const commitment: Commitment = {
  id: "commitment-1",
  caseId: "case-1",
  kind: "resolution",
  policyVersionId: policy.id,
  calendarVersionId: alwaysOpen.id,
  startedAt: "2026-09-07T09:00:00.000Z",
  targetMinutes: 240,
  dueAt: "2026-09-07T13:00:00.000Z",
  status: "on_track",
};

const baseEvents: NormalizedEvent[] = [
  {
    id: "evt-1",
    caseId: "case-1",
    type: "case_created",
    occurredAt: "2026-09-07T09:00:00.000Z",
    actor: "customer",
    system: "zendesk",
    fromState: null,
    toState: "open",
    sourceRawEventId: "raw-1",
  },
];

function minutesAfterStart(minutes: number): string {
  return new Date(
    new Date(commitment.startedAt).getTime() + minutes * 60_000,
  ).toISOString();
}

describe("evaluateCommitment", () => {
  it("is on_track below the first warning threshold", () => {
    const evaluation = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      minutesAfterStart(100),
    );
    expect(evaluation.status).toBe("on_track");
    expect(evaluation.elapsedWorkingMinutes).toBe(100);
    expect(evaluation.remainingMinutes).toBe(140);
  });

  it("transitions to at_risk once a warnAtPercent threshold is crossed", () => {
    // 200/240 = 83.3% — crosses the 80% threshold, but not yet breached.
    const evaluation = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      minutesAfterStart(200),
    );
    expect(evaluation.status).toBe("at_risk");
    expect(evaluation.remainingMinutes).toBe(40);
  });

  it("transitions to breached once elapsed exceeds the target", () => {
    const evaluation = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      minutesAfterStart(250),
    );
    expect(evaluation.status).toBe("breached");
    expect(evaluation.breachedByMinutes).toBe(10);
  });

  it("resolves to met when closed inside the target", () => {
    const events = [
      ...baseEvents,
      {
        id: "evt-close",
        caseId: "case-1",
        type: "case_closed" as const,
        occurredAt: minutesAfterStart(50),
        actor: "agent" as const,
        system: "zendesk" as const,
        fromState: "open" as const,
        toState: "resolved" as const,
        sourceRawEventId: "raw-close",
      },
    ];
    const evaluation = evaluateCommitment(
      commitment,
      events,
      policy,
      alwaysOpen,
      minutesAfterStart(300),
    );
    expect(evaluation.status).toBe("met");
    expect(evaluation.elapsedWorkingMinutes).toBe(50);
  });

  it("resolves to breached when closed past the target", () => {
    const events = [
      ...baseEvents,
      {
        id: "evt-close",
        caseId: "case-1",
        type: "case_closed" as const,
        occurredAt: minutesAfterStart(260),
        actor: "agent" as const,
        system: "zendesk" as const,
        fromState: "open" as const,
        toState: "resolved" as const,
        sourceRawEventId: "raw-close",
      },
    ];
    const evaluation = evaluateCommitment(
      commitment,
      events,
      policy,
      alwaysOpen,
      minutesAfterStart(300),
    );
    expect(evaluation.status).toBe("breached");
    expect(evaluation.breachedByMinutes).toBe(20);
  });

  it("is reproducible: identical inputs called twice produce an identical Evaluation, id included", () => {
    const asOf = minutesAfterStart(200);
    const first = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      asOf,
    );
    const second = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      asOf,
    );
    expect(first).toEqual(second);
  });

  it("records the input version ids so any number can be re-derived and explained later", () => {
    const evaluation = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      minutesAfterStart(100),
    );
    expect(evaluation.inputs).toEqual({
      lastEventId: "evt-1",
      policyVersionId: policy.id,
      calendarVersionId: alwaysOpen.id,
    });
  });
});
