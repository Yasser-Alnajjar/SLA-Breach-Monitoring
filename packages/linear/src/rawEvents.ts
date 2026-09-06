import { computeSourceHash } from "./hash";
import type { LinearAttachment, LinearHistoryEntry, LinearIssue } from "./types";

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
export function mapIssueToRawEvent(issue: LinearIssue): RawEventInput {
  const sourceHash = computeSourceHash(issue);
  return { providerEventId: `issue:${issue.id}:${sourceHash}`, sourceHash, payload: issue };
}

/**
 * History entries are Linear's immutable event log — each entry id occurs
 * exactly once, ever, so no hash suffix is needed for dedup.
 */
export function mapHistoryEntryToRawEvent(issueId: string, entry: LinearHistoryEntry): RawEventInput {
  return {
    providerEventId: `issue_history:${issueId}:${entry.id}`,
    sourceHash: computeSourceHash(entry),
    payload: entry,
  };
}

/**
 * Attachments are mutable (title/subtitle/url can be edited), so — like
 * issues — the hash is folded into the provider event id.
 */
export function mapAttachmentToRawEvent(issueId: string, attachment: LinearAttachment): RawEventInput {
  const sourceHash = computeSourceHash(attachment);
  return {
    providerEventId: `attachment:${issueId}:${attachment.id}:${sourceHash}`,
    sourceHash,
    payload: attachment,
  };
}
