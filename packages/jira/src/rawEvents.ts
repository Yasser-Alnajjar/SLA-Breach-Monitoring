import { computeSourceHash } from "./hash";
import type { JiraChangelogHistory, JiraIssue, JiraRemoteLink, JiraStatus } from "./types";

/** What gets written to one RawEvent row, minus the integrationId FK. */
export interface RawEventInput {
  providerEventId: string;
  sourceHash: string;
  payload: unknown;
}

/**
 * Issues are mutable snapshots, not events. The hash is folded into the
 * provider event id so an unchanged re-fetch collides with the existing row
 * (skipped via skipDuplicates) while a real change lands as a new, distinct
 * RawEvent — append-only either way.
 */
export function mapIssueToRawEvent(issue: JiraIssue): RawEventInput {
  const sourceHash = computeSourceHash(issue);
  return { providerEventId: `issue:${issue.key}:${sourceHash}`, sourceHash, payload: issue };
}

/**
 * Changelog histories are Jira's immutable event log — each history id
 * occurs exactly once, ever, so no hash suffix is needed for dedup.
 */
export function mapChangelogHistoryToRawEvent(issueKey: string, history: JiraChangelogHistory): RawEventInput {
  return {
    providerEventId: `issue_changelog:${issueKey}:${history.id}`,
    sourceHash: computeSourceHash(history),
    payload: history,
  };
}

/**
 * Remote links are mutable (a link's relationship or target can be edited),
 * so — like issues — the hash is folded into the provider event id.
 */
export function mapRemoteLinkToRawEvent(issueKey: string, link: JiraRemoteLink): RawEventInput {
  const sourceHash = computeSourceHash(link);
  return {
    providerEventId: `remote_link:${issueKey}:${link.id}:${sourceHash}`,
    sourceHash,
    payload: link,
  };
}

/**
 * A site's statuses can be renamed or recategorized, so — like issues — the
 * hash is folded into the provider event id.
 */
export function mapStatusToRawEvent(status: JiraStatus): RawEventInput {
  const sourceHash = computeSourceHash(status);
  return { providerEventId: `status:${status.id}:${sourceHash}`, sourceHash, payload: status };
}
