import { describe, expect, it } from "vitest";
import {
  BREACH_NOTIFICATION_THRESHOLD,
  evaluateCommitment,
  evaluateEngineeringLegTarget,
  findCaseCloseEvent,
} from "../src/evaluate.js";
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
    expect(evaluation.warnThresholdCrossed).toBeUndefined();
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
    expect(evaluation.warnThresholdCrossed).toBe(80);
  });

  it("reports the highest threshold crossed as elapsed keeps climbing within at_risk", () => {
    // 130/240 = 54.2% — crosses 50 but not 80. Same status as the 83.3% case
    // above, but notifications must key off the threshold, not the status,
    // or 80%/95% alerts would never fire while a commitment sits at at_risk.
    const evaluation = evaluateCommitment(
      commitment,
      baseEvents,
      policy,
      alwaysOpen,
      minutesAfterStart(130),
    );
    expect(evaluation.status).toBe("at_risk");
    expect(evaluation.warnThresholdCrossed).toBe(50);
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
    expect(evaluation.warnThresholdCrossed).toBe(BREACH_NOTIFICATION_THRESHOLD);
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
    expect(evaluation.warnThresholdCrossed).toBe(BREACH_NOTIFICATION_THRESHOLD);
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

  it("is not affected by a linked Jira issue reaching Done — only Zendesk closes a case", () => {
    // Zendesk ticket is still open; a linked Jira issue's own status
    // separately reached its "done" category (normalizes to "resolved"),
    // but Jira is never the anchor for the case's lifecycle.
    const events = [
      ...baseEvents,
      {
        id: "evt-jira-done",
        caseId: "case-1",
        type: "state_changed" as const,
        occurredAt: minutesAfterStart(50),
        actor: "agent" as const,
        system: "jira" as const,
        fromState: "in_progress" as const,
        toState: "resolved" as const,
        sourceRawEventId: "raw-jira",
      },
    ];
    const evaluation = evaluateCommitment(commitment, events, policy, alwaysOpen, minutesAfterStart(250));
    expect(evaluation.status).toBe("breached");
  });

  it("resumes live evaluation once a solved-then-reopened Zendesk ticket is active again", () => {
    const events = [
      ...baseEvents,
      {
        id: "evt-solved",
        caseId: "case-1",
        type: "case_closed" as const,
        occurredAt: minutesAfterStart(50),
        actor: "agent" as const,
        system: "zendesk" as const,
        fromState: "open" as const,
        toState: "resolved" as const,
        sourceRawEventId: "raw-solved",
      },
      {
        id: "evt-reopened",
        caseId: "case-1",
        type: "state_changed" as const,
        occurredAt: minutesAfterStart(60),
        actor: "customer" as const,
        system: "zendesk" as const,
        fromState: "resolved" as const,
        toState: "open" as const,
        sourceRawEventId: "raw-reopened",
      },
    ];
    // Elapsed since start (never actually paused) exceeds the 240-minute
    // target — since the ticket is open again, this must read live as
    // breached, not frozen at the stale "met" snapshot from the solve.
    const evaluation = evaluateCommitment(commitment, events, policy, alwaysOpen, minutesAfterStart(250));
    expect(evaluation.status).toBe("breached");
  });
});

describe("evaluateEngineeringLegTarget", () => {
  it("is on_track well below the target while the leg is still open", () => {
    const evaluation = evaluateEngineeringLegTarget(60, 240, true);
    expect(evaluation.status).toBe("on_track");
    expect(evaluation.remainingMinutes).toBe(180);
    expect(evaluation.breachedByMinutes).toBeUndefined();
  });

  it("transitions to at_risk once the fixed 80% warn threshold is crossed while still open", () => {
    // 200/240 = 83.3%
    const evaluation = evaluateEngineeringLegTarget(200, 240, true);
    expect(evaluation.status).toBe("at_risk");
    expect(evaluation.remainingMinutes).toBe(40);
  });

  it("is breached once elapsed exceeds the target, even while the leg is still open", () => {
    const evaluation = evaluateEngineeringLegTarget(250, 240, true);
    expect(evaluation.status).toBe("breached");
    expect(evaluation.breachedByMinutes).toBe(10);
  });

  it("resolves to met once the leg has closed under target", () => {
    const evaluation = evaluateEngineeringLegTarget(100, 240, false);
    expect(evaluation.status).toBe("met");
  });

  it("stays breached once the leg has closed over target", () => {
    const evaluation = evaluateEngineeringLegTarget(300, 240, false);
    expect(evaluation.status).toBe("breached");
    expect(evaluation.breachedByMinutes).toBe(60);
  });

  it("never reports met while the leg is still open, regardless of elapsed time", () => {
    const evaluation = evaluateEngineeringLegTarget(10, 240, true);
    expect(evaluation.status).not.toBe("met");
  });
});

describe("findCaseCloseEvent", () => {
  it("returns null when the case has never closed", () => {
    expect(findCaseCloseEvent(baseEvents, minutesAfterStart(100))).toBeNull();
  });

  it("returns the case_closed event once the case has closed", () => {
    const closeEvent = {
      id: "evt-close",
      caseId: "case-1",
      type: "case_closed" as const,
      occurredAt: minutesAfterStart(50),
      actor: "agent" as const,
      system: "zendesk" as const,
      fromState: "open" as const,
      toState: "resolved" as const,
      sourceRawEventId: "raw-close",
    };
    expect(findCaseCloseEvent([...baseEvents, closeEvent], minutesAfterStart(100))).toEqual(closeEvent);
  });

  it("ignores a case_closed event that happens after asOf", () => {
    const closeEvent = {
      id: "evt-close",
      caseId: "case-1",
      type: "case_closed" as const,
      occurredAt: minutesAfterStart(200),
      actor: "agent" as const,
      system: "zendesk" as const,
      fromState: "open" as const,
      toState: "resolved" as const,
      sourceRawEventId: "raw-close",
    };
    expect(findCaseCloseEvent([...baseEvents, closeEvent], minutesAfterStart(100))).toBeNull();
  });

  it("returns a closed Intercom conversation's case_closed event", () => {
    const closeEvent = {
      id: "evt-intercom-close",
      caseId: "case-1",
      type: "case_closed" as const,
      occurredAt: minutesAfterStart(50),
      actor: "agent" as const,
      system: "intercom" as const,
      fromState: "open" as const,
      toState: "resolved" as const,
      sourceRawEventId: "raw-intercom-close",
    };
    expect(findCaseCloseEvent([...baseEvents, closeEvent], minutesAfterStart(100))).toEqual(closeEvent);
  });

  it("ignores a Jira issue reaching a resolved/done category", () => {
    const jiraDone = {
      id: "evt-jira-done",
      caseId: "case-1",
      type: "state_changed" as const,
      occurredAt: minutesAfterStart(50),
      actor: "agent" as const,
      system: "jira" as const,
      fromState: "in_progress" as const,
      toState: "resolved" as const,
      sourceRawEventId: "raw-jira",
    };
    expect(findCaseCloseEvent([...baseEvents, jiraDone], minutesAfterStart(100))).toBeNull();
  });

  it("returns null once a solved Zendesk ticket has been reopened", () => {
    const solved = {
      id: "evt-solved",
      caseId: "case-1",
      type: "case_closed" as const,
      occurredAt: minutesAfterStart(50),
      actor: "agent" as const,
      system: "zendesk" as const,
      fromState: "open" as const,
      toState: "resolved" as const,
      sourceRawEventId: "raw-solved",
    };
    const reopened = {
      id: "evt-reopened",
      caseId: "case-1",
      type: "state_changed" as const,
      occurredAt: minutesAfterStart(60),
      actor: "customer" as const,
      system: "zendesk" as const,
      fromState: "resolved" as const,
      toState: "open" as const,
      sourceRawEventId: "raw-reopened",
    };
    expect(findCaseCloseEvent([...baseEvents, solved, reopened], minutesAfterStart(100))).toBeNull();
  });
});
