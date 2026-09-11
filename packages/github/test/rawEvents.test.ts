import { describe, expect, it } from "vitest";
import { mapPullRequestToRawEvent, mapTimelineItemToRawEvent } from "../src/rawEvents";
import type { GithubPullRequest, GithubTimelineItem } from "../src/types";

const pr: GithubPullRequest = {
  id: "pr-node-1",
  number: 42,
  title: "Fix customer escalation",
  url: "https://github.com/acme/widgets/pull/42",
  state: "OPEN",
  merged: false,
  headRefName: "eng-42-fix-thing",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  mergedAt: null,
  closedAt: null,
  author: { login: "octocat" },
};

describe("mapPullRequestToRawEvent", () => {
  it("folds the content hash into the provider event id, keyed by owner/repo#number", () => {
    const result = mapPullRequestToRawEvent("acme", "widgets", pr);
    expect(result.providerEventId).toBe(`pull_request:acme/widgets#42:${result.sourceHash}`);
  });

  it("produces a different provider event id when the pull request changes", () => {
    const before = mapPullRequestToRawEvent("acme", "widgets", pr);
    const after = mapPullRequestToRawEvent("acme", "widgets", { ...pr, state: "MERGED", merged: true });
    expect(after.providerEventId).not.toBe(before.providerEventId);
  });

  it("produces the same provider event id for an unchanged re-fetch", () => {
    const first = mapPullRequestToRawEvent("acme", "widgets", pr);
    const second = mapPullRequestToRawEvent("acme", "widgets", { ...pr });
    expect(second.providerEventId).toBe(first.providerEventId);
  });
});

describe("mapTimelineItemToRawEvent", () => {
  it("keys by owner/repo#number and item id alone — timeline items are immutable, never re-hashed", () => {
    const item: GithubTimelineItem = {
      __typename: "MergedEvent",
      id: "event-1",
      createdAt: "2026-01-02T00:00:00.000Z",
      actor: { login: "octocat" },
    };
    const result = mapTimelineItemToRawEvent("acme", "widgets", 42, item);
    expect(result.providerEventId).toBe("pr_timeline:acme/widgets#42:event-1");
    expect(result.payload).toBe(item);
  });
});
