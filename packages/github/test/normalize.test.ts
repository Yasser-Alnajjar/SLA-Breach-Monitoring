import { describe, expect, it } from "vitest";
import {
  deriveNormalizedEventsForPullRequest,
  normalizeGithubTimelineItemType,
  resolveGithubActor,
  sortTimelineChronologically,
  UnknownGithubTimelineItemTypeError,
  type TimelineRecord,
} from "../src/normalize";
import type { GithubPullRequest, GithubTimelineItem } from "../src/types";

const pr: GithubPullRequest = {
  id: "pr-node-1",
  number: 42,
  title: "Fix customer escalation",
  url: "https://github.com/acme/widgets/pull/42",
  state: "MERGED",
  merged: true,
  headRefName: "eng-42-fix-thing",
  createdAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-01-03T12:00:00.000Z",
  mergedAt: "2026-01-03T12:00:00.000Z",
  closedAt: "2026-01-03T12:00:00.000Z",
  author: { login: "octocat" },
};

function timelineRecord(overrides: Partial<GithubTimelineItem> & { id: string }): TimelineRecord {
  return {
    rawEventId: `raw_${overrides.id}`,
    item: {
      __typename: "ReadyForReviewEvent",
      createdAt: "2026-01-01T09:00:00.000Z",
      actor: { login: "octocat" },
      ...overrides,
    },
  };
}

describe("normalizeGithubTimelineItemType", () => {
  it("maps every known timeline item type", () => {
    expect(normalizeGithubTimelineItemType("ReadyForReviewEvent")).toBe("in_progress");
    expect(normalizeGithubTimelineItemType("ReviewRequestedEvent")).toBe("in_progress");
    expect(normalizeGithubTimelineItemType("PullRequestReview")).toBe("in_progress");
    expect(normalizeGithubTimelineItemType("MergedEvent")).toBe("resolved");
    expect(normalizeGithubTimelineItemType("ClosedEvent")).toBe("closed");
    expect(normalizeGithubTimelineItemType("ReopenedEvent")).toBe("open");
  });

  it("throws a named error on an unrecognized type", () => {
    expect(() => normalizeGithubTimelineItemType("BogusEvent")).toThrow(UnknownGithubTimelineItemTypeError);
  });
});

describe("resolveGithubActor", () => {
  it("attributes a null/undefined actor (an automation with no impersonated user) to the system", () => {
    expect(resolveGithubActor(null)).toBe("system");
    expect(resolveGithubActor(undefined)).toBe("system");
  });

  it("attributes any named actor to the agent — never the customer", () => {
    expect(resolveGithubActor({ login: "octocat" })).toBe("agent");
  });
});

describe("sortTimelineChronologically", () => {
  it("orders by createdAt, then by item id as a tiebreaker", () => {
    const a = timelineRecord({ id: "c-300", createdAt: "2026-01-01T10:00:00Z" });
    const b = timelineRecord({ id: "a-100", createdAt: "2026-01-01T09:00:00Z" });
    const c = timelineRecord({ id: "b-200", createdAt: "2026-01-01T09:00:00Z" });
    expect(sortTimelineChronologically([a, b, c]).map((r) => r.rawEventId)).toEqual([
      "raw_a-100",
      "raw_b-200",
      "raw_c-300",
    ]);
  });
});

describe("deriveNormalizedEventsForPullRequest", () => {
  it("synthesizes the initial `open` event from the pull request snapshot when there is no timeline", () => {
    const events = deriveNormalizedEventsForPullRequest(pr, [], "raw_pr_42");
    expect(events).toEqual([
      {
        occurredAt: pr.createdAt,
        actor: "agent",
        fromState: null,
        toState: "open",
        sourceRawEventId: "raw_pr_42",
      },
    ]);
  });

  it("chains each timeline item from the previous event's toState", () => {
    const timeline = [
      timelineRecord({
        id: "1",
        __typename: "ReviewRequestedEvent",
        createdAt: "2026-01-01T10:00:00Z",
      }),
      timelineRecord({
        id: "2",
        __typename: "MergedEvent",
        createdAt: "2026-01-03T12:00:00Z",
      }),
    ];
    const events = deriveNormalizedEventsForPullRequest(pr, timeline, "raw_pr_42");
    expect(events.map((e) => [e.fromState, e.toState])).toEqual([
      [null, "open"],
      ["open", "in_progress"],
      ["in_progress", "resolved"],
    ]);
  });

  it("emits one state_changed-shaped event per timeline item, in chronological order", () => {
    const timeline = [
      timelineRecord({ id: "2", createdAt: "2026-01-02T09:00:00Z", __typename: "ClosedEvent" }),
      timelineRecord({ id: "1", createdAt: "2026-01-01T09:05:00Z", __typename: "ReadyForReviewEvent" }),
    ];
    const events = deriveNormalizedEventsForPullRequest(pr, timeline, "raw_pr_42");
    expect(events.map((e) => e.sourceRawEventId)).toEqual(["raw_pr_42", "raw_1", "raw_2"]);
  });

  it("resolves each event's actor independently from its own timeline item", () => {
    const timeline = [
      timelineRecord({ id: "1", createdAt: "2026-01-01T09:05:00Z", actor: { login: "octocat" } }),
      timelineRecord({ id: "2", createdAt: "2026-01-02T09:00:00Z", actor: null, __typename: "ClosedEvent" }),
    ];
    const events = deriveNormalizedEventsForPullRequest(pr, timeline, "raw_pr_42");
    expect(events[1]?.actor).toBe("agent");
    expect(events[2]?.actor).toBe("system");
  });

  it("throws a named error when a timeline item's type isn't recognized", () => {
    const timeline = [
      timelineRecord({ id: "1", createdAt: "2026-01-01T09:05:00Z", __typename: "BogusEvent" as never }),
    ];
    expect(() => deriveNormalizedEventsForPullRequest(pr, timeline, "raw_pr_42")).toThrow(
      UnknownGithubTimelineItemTypeError,
    );
  });
});
