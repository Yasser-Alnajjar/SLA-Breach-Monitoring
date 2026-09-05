import { describe, expect, it } from "vitest";
import {
  mapChangelogHistoryToRawEvent,
  mapIssueToRawEvent,
  mapRemoteLinkToRawEvent,
  mapStatusToRawEvent,
} from "../src/rawEvents";
import type { JiraChangelogHistory, JiraIssue, JiraRemoteLink, JiraStatus } from "../src/types";

const issue: JiraIssue = {
  id: "10042",
  key: "SUP-42",
  self: "https://acme.atlassian.net/rest/api/3/issue/10042",
  fields: {
    summary: "Customer escalation",
    status: { id: "1", name: "Open" },
    priority: { id: "2", name: "High" },
    project: { id: "10", key: "SUP", name: "Support" },
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    reporter: { accountId: "acc-1" },
    assignee: null,
  },
};

describe("mapIssueToRawEvent", () => {
  it("folds the content hash into the provider event id", () => {
    const result = mapIssueToRawEvent(issue);
    expect(result.providerEventId).toBe(`issue:SUP-42:${result.sourceHash}`);
  });

  it("produces a different provider event id when the issue changes", () => {
    const before = mapIssueToRawEvent(issue);
    const after = mapIssueToRawEvent({
      ...issue,
      fields: { ...issue.fields, status: { id: "2", name: "Pending" } },
    });
    expect(after.providerEventId).not.toBe(before.providerEventId);
  });

  it("produces the same provider event id for an unchanged re-fetch", () => {
    const first = mapIssueToRawEvent(issue);
    const second = mapIssueToRawEvent({ ...issue, fields: { ...issue.fields } });
    expect(second.providerEventId).toBe(first.providerEventId);
  });
});

describe("mapChangelogHistoryToRawEvent", () => {
  it("keys by issue key and history id alone — histories are immutable, never re-hashed", () => {
    const history: JiraChangelogHistory = {
      id: "5001",
      author: { accountId: "acc-1" },
      created: "2026-01-01T00:00:00.000Z",
      items: [{ field: "status", fieldtype: "jira", from: "1", fromString: "Open", to: "2", toString: "Pending" }],
    };
    const result = mapChangelogHistoryToRawEvent("SUP-42", history);
    expect(result.providerEventId).toBe("issue_changelog:SUP-42:5001");
    expect(result.payload).toBe(history);
  });
});

describe("mapRemoteLinkToRawEvent", () => {
  it("keys by issue key, link id, and content hash", () => {
    const link: JiraRemoteLink = {
      id: 900,
      self: "https://acme.atlassian.net/rest/api/3/issue/10042/remotelink/900",
      object: { url: "https://acme.zendesk.com/agent/tickets/42", title: "ZD-42" },
    };
    const result = mapRemoteLinkToRawEvent("SUP-42", link);
    expect(result.providerEventId).toBe(`remote_link:SUP-42:900:${result.sourceHash}`);
  });
});

describe("mapStatusToRawEvent", () => {
  it("keys by status id and content hash", () => {
    const status: JiraStatus = { id: "3", name: "Done", statusCategory: { key: "done", name: "Done" } };
    const result = mapStatusToRawEvent(status);
    expect(result.providerEventId).toBe(`status:3:${result.sourceHash}`);
  });

  it("produces a different provider event id when the category changes", () => {
    const before = mapStatusToRawEvent({ id: "3", name: "Done", statusCategory: { key: "done", name: "Done" } });
    const after = mapStatusToRawEvent({ id: "3", name: "Done", statusCategory: { key: "indeterminate", name: "Done" } });
    expect(after.providerEventId).not.toBe(before.providerEventId);
  });
});
