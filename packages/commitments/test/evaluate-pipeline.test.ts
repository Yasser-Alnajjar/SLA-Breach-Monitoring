import { describe, expect, it } from "vitest";
import {
  isTerminalStatus,
  shouldPersistEvaluation,
  toCommitmentDomain,
  toNormalizedEventDomain,
  type CommitmentRecord,
} from "../src/evaluate-pipeline";

function commitmentRow(
  overrides: Partial<CommitmentRecord> = {},
): CommitmentRecord {
  return {
    id: "cmt_1",
    caseId: "case_1",
    kind: "first_response",
    policyVersionId: "pv_1",
    calendarVersionId: "cal_1",
    startedAt: new Date("2026-01-01T09:00:00Z"),
    targetMinutes: 60,
    dueAt: new Date("2026-01-01T10:00:00Z"),
    status: "on_track",
    closedAt: null,
    ...overrides,
  };
}

describe("isTerminalStatus", () => {
  it("treats met as final", () => {
    expect(isTerminalStatus("met", true)).toBe(true);
  });

  it("treats breached as final only once the commitment has completed", () => {
    expect(isTerminalStatus("breached", true)).toBe(true);
    expect(isTerminalStatus("breached", false)).toBe(false);
  });

  it("never finalizes a commitment that is still running", () => {
    expect(isTerminalStatus("on_track", false)).toBe(false);
    expect(isTerminalStatus("at_risk", false)).toBe(false);
    expect(isTerminalStatus("at_risk", true)).toBe(false);
  });
});

describe("shouldPersistEvaluation", () => {
  it("persists the first evaluation of a commitment", () => {
    expect(shouldPersistEvaluation("on_track", null, false, false)).toBe(true);
  });

  it("persists a status transition", () => {
    expect(shouldPersistEvaluation("at_risk", "on_track", false, false)).toBe(
      true,
    );
    expect(shouldPersistEvaluation("breached", "at_risk", false, false)).toBe(
      true,
    );
  });

  it("writes nothing when a poll finds the same status again", () => {
    expect(shouldPersistEvaluation("on_track", "on_track", false, false)).toBe(
      false,
    );
    expect(shouldPersistEvaluation("at_risk", "at_risk", false, false)).toBe(
      false,
    );
  });

  it("persists the final snapshot when a case closes on an already-breached commitment", () => {
    expect(shouldPersistEvaluation("breached", "breached", true, false)).toBe(
      true,
    );
  });

  it("stops re-persisting once the commitment is finalized", () => {
    expect(shouldPersistEvaluation("breached", "breached", true, true)).toBe(
      false,
    );
    expect(shouldPersistEvaluation("met", "met", true, true)).toBe(false);
  });
});

describe("toCommitmentDomain", () => {
  it("converts dates to ISO strings and a null closedAt to undefined", () => {
    expect(toCommitmentDomain(commitmentRow())).toEqual({
      id: "cmt_1",
      caseId: "case_1",
      kind: "first_response",
      policyVersionId: "pv_1",
      calendarVersionId: "cal_1",
      startedAt: "2026-01-01T09:00:00.000Z",
      targetMinutes: 60,
      dueAt: "2026-01-01T10:00:00.000Z",
      status: "on_track",
      closedAt: undefined,
    });
  });

  it("passes through a closedAt that is set", () => {
    const domain = toCommitmentDomain(
      commitmentRow({ closedAt: new Date("2026-01-01T09:45:00Z") }),
    );
    expect(domain.closedAt).toBe("2026-01-01T09:45:00.000Z");
  });
});

describe("toNormalizedEventDomain", () => {
  it("maps a persisted row onto the pure event shape", () => {
    expect(
      toNormalizedEventDomain({
        id: "evt_1",
        caseId: "case_1",
        type: "state_changed",
        occurredAt: new Date("2026-01-01T09:15:00Z"),
        actor: "agent",
        system: "zendesk",
        fromState: "new",
        toState: "open",
        sourceRawEventId: "raw_1",
      }),
    ).toEqual({
      id: "evt_1",
      caseId: "case_1",
      type: "state_changed",
      occurredAt: "2026-01-01T09:15:00.000Z",
      actor: "agent",
      system: "zendesk",
      fromState: "new",
      toState: "open",
      sourceRawEventId: "raw_1",
    });
  });
});
