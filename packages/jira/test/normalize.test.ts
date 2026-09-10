import { describe, expect, it } from "vitest";
import {
  buildStatusLookup,
  deriveNormalizedEventsForIssue,
  normalizeJiraStatusCategory,
  resolveJiraActor,
  sortHistoriesChronologically,
  UnknownJiraStatusCategoryError,
  UnknownJiraStatusError,
  type ChangelogRecord,
} from "../src/normalize";
import type { JiraChangelogHistory, JiraIssue, JiraStatus } from "../src/types";

const issue: JiraIssue = {
  id: "10042",
  key: "SUP-42",
  self: "https://acme.atlassian.net/rest/api/3/issue/10042",
  fields: {
    summary: "Customer escalation",
    status: { id: "3", name: "Done", statusCategory: { key: "done" } },
    priority: { id: "2", name: "High" },
    project: { id: "10", key: "SUP", name: "Support" },
    created: "2026-01-01T09:00:00.000Z",
    updated: "2026-01-03T12:00:00.000Z",
    reporter: { accountId: "acc-reporter" },
    assignee: { accountId: "acc-agent" },
  },
};

const statuses: JiraStatus[] = [
  { id: "1", name: "To Do", statusCategory: { key: "new", name: "To Do" } },
  { id: "2", name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
  { id: "3", name: "Done", statusCategory: { key: "done", name: "Done" } },
];

function historyRecord(overrides: Partial<JiraChangelogHistory> & { id: string }): ChangelogRecord {
  return {
    rawEventId: `raw_${overrides.id}`,
    history: {
      author: { accountId: "acc-agent" },
      created: "2026-01-01T09:00:00.000Z",
      items: [],
      ...overrides,
    },
  };
}

function statusChangeItem(from: string, to: string) {
  return { field: "status", fieldtype: "jira", from, fromString: null, to, toString: null };
}

describe("normalizeJiraStatusCategory", () => {
  it("maps every known category", () => {
    expect(normalizeJiraStatusCategory("new")).toBe("new");
    expect(normalizeJiraStatusCategory("indeterminate")).toBe("in_progress");
    expect(normalizeJiraStatusCategory("done")).toBe("resolved");
  });

  it("throws a named error on an unrecognized category", () => {
    expect(() => normalizeJiraStatusCategory("bogus")).toThrow(UnknownJiraStatusCategoryError);
  });
});

describe("buildStatusLookup", () => {
  it("resolves each status id to its category's normalized state and preserves its own Jira name", () => {
    const lookup = buildStatusLookup(statuses);
    expect(lookup.get("1")).toEqual({ normalizedState: "new", name: "To Do" });
    expect(lookup.get("2")).toEqual({ normalizedState: "in_progress", name: "In Progress" });
    expect(lookup.get("3")).toEqual({ normalizedState: "resolved", name: "Done" });
  });

  it("preserves arbitrary, workflow-specific status names untouched", () => {
    const customWorkflow: JiraStatus[] = [
      { id: "10", name: "Open", statusCategory: { key: "new", name: "To Do" } },
      { id: "11", name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "12", name: "Code Review", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "13", name: "QA", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "14", name: "Blocked", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "15", name: "Ready for Deploy", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "16", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    const lookup = buildStatusLookup(customWorkflow);
    for (const status of customWorkflow) {
      expect(lookup.get(status.id)?.name).toBe(status.name);
    }
    // All the intermediate custom names still collapse to the same SLA state.
    expect(["11", "12", "13", "14", "15"].map((id) => lookup.get(id)?.normalizedState)).toEqual([
      "in_progress",
      "in_progress",
      "in_progress",
      "in_progress",
      "in_progress",
    ]);
  });
});

describe("resolveJiraActor", () => {
  it("attributes a null author (an automation acting without a user) to the system", () => {
    expect(resolveJiraActor(null, issue)).toBe("system");
    expect(resolveJiraActor(undefined, issue)).toBe("system");
  });

  it("attributes the issue's reporter to the customer", () => {
    expect(resolveJiraActor("acc-reporter", issue)).toBe("customer");
  });

  it("defaults to agent for anyone else", () => {
    expect(resolveJiraActor("acc-agent", issue)).toBe("agent");
  });
});

describe("sortHistoriesChronologically", () => {
  it("orders by created, then by numeric history id as a tiebreaker", () => {
    const a = historyRecord({ id: "300", created: "2026-01-01T10:00:00Z" });
    const b = historyRecord({ id: "100", created: "2026-01-01T09:00:00Z" });
    const c = historyRecord({ id: "200", created: "2026-01-01T09:00:00Z" });
    expect(sortHistoriesChronologically([a, b, c]).map((r) => r.rawEventId)).toEqual([
      "raw_100",
      "raw_200",
      "raw_300",
    ]);
  });
});

describe("deriveNormalizedEventsForIssue", () => {
  const statusById = buildStatusLookup(statuses);

  it("synthesizes the initial event from the issue snapshot when there are no status-changing histories", () => {
    const events = deriveNormalizedEventsForIssue(issue, [], "raw_issue_42", statusById);
    expect(events).toEqual([
      {
        occurredAt: issue.fields.created,
        actor: "customer",
        fromState: null,
        toState: "resolved",
        fromStatusName: null,
        toStatusName: "Done",
        sourceRawEventId: "raw_issue_42",
      },
    ]);
  });

  it("takes the initial state from the first status change's `from` id", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        author: { accountId: "acc-agent" },
        items: [statusChangeItem("1", "2")],
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42", statusById);
    expect(events[0]).toMatchObject({ fromState: null, toState: "new", fromStatusName: null, toStatusName: "To Do" });
    expect(events[1]).toMatchObject({
      fromState: "new",
      toState: "in_progress",
      fromStatusName: "To Do",
      toStatusName: "In Progress",
      sourceRawEventId: "raw_1",
    });
  });

  it("emits one state_changed-shaped event per status transition, in order", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        author: { accountId: "acc-agent" },
        items: [statusChangeItem("1", "2")],
      }),
      historyRecord({
        id: "2",
        created: "2026-01-02T09:00:00Z",
        author: { accountId: "acc-agent" },
        items: [statusChangeItem("2", "3")],
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42", statusById);
    expect(events.map((e) => [e.fromState, e.toState])).toEqual([
      [null, "new"],
      ["new", "in_progress"],
      ["in_progress", "resolved"],
    ]);
  });

  describe("with an arbitrary, workflow-specific status vocabulary", () => {
    // Open -> In Progress -> Code Review -> QA -> Blocked -> Ready for Deploy -> Done
    const customStatuses: JiraStatus[] = [
      { id: "10", name: "Open", statusCategory: { key: "new", name: "To Do" } },
      { id: "11", name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "12", name: "Code Review", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "13", name: "QA", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "14", name: "Blocked", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "15", name: "Ready for Deploy", statusCategory: { key: "indeterminate", name: "In Progress" } },
      { id: "16", name: "Done", statusCategory: { key: "done", name: "Done" } },
    ];
    const customStatusById = buildStatusLookup(customStatuses);
    const customIssue: JiraIssue = {
      ...issue,
      fields: { ...issue.fields, status: { id: "16", name: "Done", statusCategory: { key: "done" } } },
    };

    function transitionHistories() {
      const transitions: [string, string, string][] = [
        ["1", "2026-01-01T09:05:00Z", "10"],
        ["2", "2026-01-02T09:00:00Z", "11"],
        ["3", "2026-01-03T09:00:00Z", "12"],
        ["4", "2026-01-04T09:00:00Z", "13"],
        ["5", "2026-01-05T09:00:00Z", "14"],
        ["6", "2026-01-06T09:00:00Z", "15"],
        ["7", "2026-01-07T09:00:00Z", "16"],
      ];
      return transitions.slice(1).map(([id, created], i) =>
        historyRecord({
          id,
          created,
          author: { accountId: "acc-agent" },
          items: [statusChangeItem(transitions[i]![2], transitions[i + 1]![2])],
        }),
      );
    }

    it("preserves each transition's own Jira status name on the timeline", () => {
      const events = deriveNormalizedEventsForIssue(customIssue, transitionHistories(), "raw_issue_42", customStatusById);
      expect(events.map((e) => [e.fromStatusName, e.toStatusName])).toEqual([
        [null, "Open"],
        ["Open", "In Progress"],
        ["In Progress", "Code Review"],
        ["Code Review", "QA"],
        ["QA", "Blocked"],
        ["Blocked", "Ready for Deploy"],
        ["Ready for Deploy", "Done"],
      ]);
    });

    it("keeps the normalized SLA states correct alongside the custom names, unaffected by the names", () => {
      const events = deriveNormalizedEventsForIssue(customIssue, transitionHistories(), "raw_issue_42", customStatusById);
      expect(events.map((e) => [e.fromState, e.toState])).toEqual([
        [null, "new"],
        ["new", "in_progress"],
        ["in_progress", "in_progress"],
        ["in_progress", "in_progress"],
        ["in_progress", "in_progress"],
        ["in_progress", "in_progress"],
        ["in_progress", "resolved"],
      ]);
    });

    it("does not let the issue's current/latest status name overwrite earlier historical transitions", () => {
      // customIssue.fields.status is "Done" (the current status), yet the
      // second-to-last historical entry must still read "Ready for Deploy".
      const events = deriveNormalizedEventsForIssue(customIssue, transitionHistories(), "raw_issue_42", customStatusById);
      expect(events[5]).toMatchObject({ fromStatusName: "Blocked", toStatusName: "Ready for Deploy" });
      expect(events.filter((e) => e.toStatusName === "Done")).toHaveLength(1);
    });

    it("preserves the synthetic initial event's actual starting status name, not a hardcoded one", () => {
      const events = deriveNormalizedEventsForIssue(customIssue, transitionHistories(), "raw_issue_42", customStatusById);
      expect(events[0]).toMatchObject({ fromState: null, toState: "new", fromStatusName: null, toStatusName: "Open" });
    });
  });

  it("resolves each transition's actor independently from its own history", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        author: { accountId: "acc-reporter" },
        items: [statusChangeItem("1", "2")],
      }),
      historyRecord({
        id: "2",
        created: "2026-01-02T09:00:00Z",
        author: null,
        items: [statusChangeItem("2", "3")],
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42", statusById);
    expect(events[1]?.actor).toBe("customer");
    expect(events[2]?.actor).toBe("system");
  });

  it("ignores non-status items and histories with no status change", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        items: [{ field: "priority", fieldtype: "priority", from: "2", fromString: "High", to: "1", toString: "Highest" }],
      }),
    ];
    const events = deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42", statusById);
    expect(events).toHaveLength(1);
  });

  it("throws a named error when a status id isn't in the site's status list", () => {
    const histories = [
      historyRecord({ id: "1", created: "2026-01-01T09:05:00Z", items: [statusChangeItem("1", "999")] }),
    ];
    expect(() => deriveNormalizedEventsForIssue(issue, histories, "raw_issue_42", statusById)).toThrow(
      UnknownJiraStatusError,
    );
  });
});
