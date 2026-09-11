import { computeSourceHash } from "./hash";
import type { GithubPullRequest, GithubTimelineItem } from "./types";

/** What gets written to one RawEvent row, minus the integrationId FK. */
export interface RawEventInput {
  providerEventId: string;
  sourceHash: string;
  payload: unknown;
}

/**
 * Pull requests are mutable snapshots, not events. The hash is folded into
 * the provider event id so an unchanged re-fetch collides with the existing
 * row (skipped via skipDuplicates) while a real change lands as a new,
 * distinct RawEvent — append-only either way. Keyed by `owner/repo#number`
 * rather than GitHub's own node id, since that's the externalId shape
 * CaseLink and the outbound PR link both use.
 */
export function mapPullRequestToRawEvent(owner: string, repo: string, pr: GithubPullRequest): RawEventInput {
  const sourceHash = computeSourceHash(pr);
  return {
    providerEventId: `pull_request:${owner}/${repo}#${pr.number}:${sourceHash}`,
    sourceHash,
    payload: pr,
  };
}

/**
 * PR timeline items are GitHub's immutable event log — each item id occurs
 * exactly once, ever, so no hash suffix is needed for dedup.
 */
export function mapTimelineItemToRawEvent(
  owner: string,
  repo: string,
  prNumber: number,
  item: GithubTimelineItem,
): RawEventInput {
  return {
    providerEventId: `pr_timeline:${owner}/${repo}#${prNumber}:${item.id}`,
    sourceHash: computeSourceHash(item),
    payload: item,
  };
}
