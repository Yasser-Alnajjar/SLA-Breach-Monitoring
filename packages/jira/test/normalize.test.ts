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
  {
    id: "2",
    name: "In Progress",
    statusCategory: { key: "indeterminate", name: "In Progress" },
  },
  { id: "3", name: "Done", statusCategory: { key: "done", name: "Done" } },
];

function historyRecord(
  overrides: Partial<JiraChangelogHistory> & { id: string },
): ChangelogRecord {
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
  return {
    field: "status",
    fieldtype: "jira",
    from,
    fromString: null,
    to,
    toString: null,
  };
}

describe("normalizeJiraStatusCategory", () => {
  it("maps every known category", () => {
    expect(normalizeJiraStatusCategory("new")).toBe("new");
    expect(normalizeJiraStatusCategory("indeterminate")).toBe("in_progress");
    expect(normalizeJiraStatusCategory("done")).toBe("resolved");
  });

  it("throws a named error on an unrecognized category", () => {
    expect(() => normalizeJiraStatusCategory("bogus")).toThrow(
      UnknownJiraStatusCategoryError,
    );
  });
});

describe("buildStatusLookup", () => {
  it("resolves each status id to its category's normalized state", () => {
    const lookup = buildStatusLookup(statuses);
    expect(lookup.get("1")).toBe("new");
    expect(lookup.get("2")).toBe("in_progress");
    expect(lookup.get("3")).toBe("resolved");
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
    expect(
      sortHistoriesChronologically([a, b, c]).map((r) => r.rawEventId),
    ).toEqual(["raw_100", "raw_200", "raw_300"]);
  });
});

describe("deriveNormalizedEventsForIssue", () => {
  const statusById = buildStatusLookup(statuses);

  it("synthesizes the initial event from the issue snapshot when there are no status-changing histories", () => {
    const events = deriveNormalizedEventsForIssue(
      issue,
      [],
      "raw_issue_42",
      statusById,
    );
    expect(events).toEqual([
      {
        occurredAt: issue.fields.created,
        actor: "customer",
        fromState: null,
        toState: "resolved",
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
    const events = deriveNormalizedEventsForIssue(
      issue,
      histories,
      "raw_issue_42",
      statusById,
    );
    expect(events[0]).toMatchObject({ fromState: null, toState: "new" });
    expect(events[1]).toMatchObject({
      fromState: "new",
      toState: "in_progress",
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
    const events = deriveNormalizedEventsForIssue(
      issue,
      histories,
      "raw_issue_42",
      statusById,
    );
    expect(events.map((e) => [e.fromState, e.toState])).toEqual([
      [null, "new"],
      ["new", "in_progress"],
      ["in_progress", "resolved"],
    ]);
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
    const events = deriveNormalizedEventsForIssue(
      issue,
      histories,
      "raw_issue_42",
      statusById,
    );
    expect(events[1]?.actor).toBe("customer");
    expect(events[2]?.actor).toBe("system");
  });

  it("ignores non-status items and histories with no status change", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        items: [
          {
            field: "priority",
            fieldtype: "priority",
            from: "2",
            fromString: "High",
            to: "1",
            toString: "Highest",
          },
        ],
      }),
    ];
    const events = deriveNormalizedEventsForIssue(
      issue,
      histories,
      "raw_issue_42",
      statusById,
    );
    expect(events).toHaveLength(1);
  });

  it("throws a named error when a status id isn't in the site's status list", () => {
    const histories = [
      historyRecord({
        id: "1",
        created: "2026-01-01T09:05:00Z",
        items: [statusChangeItem("1", "999")],
      }),
    ];
    expect(() =>
      deriveNormalizedEventsForIssue(
        issue,
        histories,
        "raw_issue_42",
        statusById,
      ),
    ).toThrow(UnknownJiraStatusError);
  });
});
