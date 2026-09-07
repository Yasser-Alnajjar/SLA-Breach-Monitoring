import { describe, expect, it } from "vitest";
import {
  deriveNormalizedEventsForIssue,
  normalizeLinearStateType,
  resolveLinearActor,
  sortHistoriesChronologically,
  UnknownLinearStateTypeError,
  type HistoryRecord,
} from "../src/normalize";
import type { LinearHistoryEntry, LinearIssue, LinearWorkflowState } from "../src/types";

const backlogState: LinearWorkflowState = { id: "s1", name: "Backlog", type: "backlog" };
const startedState: LinearWorkflowState = { id: "s2", name: "In Progress", type: "started" };
const completedState: LinearWorkflowState = { id: "s3", name: "Done", type: "completed" };

const issue: LinearIssue = {
  id: "issue-uuid-42",
  identifier: "ENG-42",
  title: "Customer escalation",
  url: "https://linear.app/acme/issue/ENG-42",
  priority: 2,
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-03T12:00:00.000Z",
  state: completedState,
  team: { id: "team-1", key: "ENG", name: "Engineering" },
  creator: { id: "user-customer", name: "Reporter" },
  assignee: { id: "user-agent", name: "Agent" },
};

function historyRecord(overrides: Partial<LinearHistoryEntry> & { id: string }): HistoryRecord {
  return {
    rawEventId: `raw_${overrides.id}`,
    entry: {
      actor: { id: "user-agent", name: "Agent" },
      createdAt: "2026-01-01T09:00:00.000Z",
      fromState: null,
      toState: null,
      ...overrides,
    },
  };
}

describe("normalizeLinearStateType", () => {
  it("maps every known type", () => {
    expect(normalizeLinearStateType("triage")).toBe("new");
    expect(normalizeLinearStateType("backlog")).toBe("open");
    expect(normalizeLinearStateType("unstarted")).toBe("open");
    expect(normalizeLinearStateType("started")).toBe("in_progress");
    expect(normalizeLinearStateType("completed")).toBe("resolved");
    expect(normalizeLinearStateType("canceled")).toBe("closed");
  });

  it("throws a named error on an unrecognized type", () => {
    expect(() => normalizeLinearStateType("bogus")).toThrow(UnknownLinearStateTypeError);
  });
});

describe("resolveLinearActor", () => {
  it("attributes a null actor (an automation acting without a user) to the system", () => {
    expect(resolveLinearActor(null, issue)).toBe("system");
    expect(resolveLinearActor(undefined, issue)).toBe("system");
  });

  it("attributes the issue's creator to the customer", () => {
    expect(resolveLinearActor({ id: "user-customer", name: "Reporter" }, issue)).toBe("customer");
  });

  it("defaults to agent for anyone else", () => {
    expect(resolveLinearActor({ id: "user-agent", name: "Agent" }, issue)).toBe("agent");
  });
});

describe("sortHistoriesChronologically", () => {
  it("orders by createdAt, then by entry id as a tiebreaker", () => {
    const a = historyRecord({ id: "c-300", createdAt: "2026-01-01T10:00:00Z" });
    const b = historyRecord({ id: "a-100", createdAt: "2026-01-01T09:00:00Z" });
    const c = historyRecord({ id: "b-200", createdAt: "2026-01-01T09:00:00Z" });
    expect(sortHistoriesChronologically([a, b, c]).map((r) => r.rawEventId)).toEqual([
      "raw_a-100",
      "raw_b-200",
      "raw_c-300",
    ]);
  });
});

describe("deriveNormalizedEventsForIssue", () => {
  it("synthesizes the initial event from the issue snapshot when there are no state-changing histories", () => {
    const events = deriveNormalizedEventsForIssue(issue, [], "raw_issue_42");
    expect(events).toEqual([
      {
        occurredAt: issue.createdAt,
        actor: "customer",
        fromState: null,
        toState: "resolved",
        sourceRawEventId: "raw_issue_42",
      },
    ]);
  });

  it("takes the initial state from the first state change's `fromState`", () => {
    const histories = [
      historyRecord({
        id: "1",
        createdAt: "2026-01-01T09:05:00Z",
        actor: { id: "user-agent", name: "Agent" },
        fromState: backlogState,
        toState: startedState,
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42");
    expect(events[0]).toMatchObject({ fromState: null, toState: "open" });
    expect(events[1]).toMatchObject({
      fromState: "open",
      toState: "in_progress",
      sourceRawEventId: "raw_1",
    });
  });

  it("emits one state_changed-shaped event per state transition, in order", () => {
    const histories = [
      historyRecord({
        id: "1",
        createdAt: "2026-01-01T09:05:00Z",
        fromState: backlogState,
        toState: startedState,
      }),
      historyRecord({
        id: "2",
        createdAt: "2026-01-02T09:00:00Z",
        fromState: startedState,
        toState: completedState,
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42");
    expect(events.map((e) => [e.fromState, e.toState])).toEqual([
      [null, "open"],
      ["open", "in_progress"],
      ["in_progress", "resolved"],
    ]);
  });

  it("resolves each transition's actor independently from its own history", () => {
    const histories = [
      historyRecord({
        id: "1",
        createdAt: "2026-01-01T09:05:00Z",
        actor: { id: "user-customer", name: "Reporter" },
        fromState: backlogState,
        toState: startedState,
      }),
      historyRecord({
        id: "2",
        createdAt: "2026-01-02T09:00:00Z",
        actor: null,
        fromState: startedState,
        toState: completedState,
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42");
    expect(events[1]?.actor).toBe("customer");
    expect(events[2]?.actor).toBe("system");
  });

  it("ignores history entries with no state change", () => {
    const histories = [
      historyRecord({ id: "1", createdAt: "2026-01-01T09:05:00Z", fromState: null, toState: null }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42");
    expect(events).toHaveLength(1);
  });

  it("throws a named error when a state's type isn't recognized", () => {
    const bogusState: LinearWorkflowState = { id: "s9", name: "???", type: "bogus" };
    const histories = [
      historyRecord({ id: "1", createdAt: "2026-01-01T09:05:00Z", fromState: backlogState, toState: bogusState }),
    ];
    expect(() => deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42")).toThrow(
      UnknownLinearStateTypeError,
    );
  });
});
