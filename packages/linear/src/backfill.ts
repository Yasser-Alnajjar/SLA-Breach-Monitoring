import type { Prisma, PrismaClient } from "@sla/db";
import { LinearClient } from "./client";
import { mapAttachmentToRawEvent, mapHistoryEntryToRawEvent, mapIssueToRawEvent, type RawEventInput } from "./rawEvents";
import { loadFreshLinearCredentials, markReauthRequired } from "./tokenLifecycle";
import type { LinearCursor } from "./types";

const DEFAULT_BACKFILL_DAYS = 90;

export interface BackfillResult {
  issuesFetched: number;
  historyEntriesFetched: number;
  attachmentsFetched: number;
}

/**
 * Pulls issues, history entries (status transitions), and attachments
 * (linked resources) into RawEvent. Raw ingestion only — normalization and
 * correlation land in roadmap step 15. Resumable: the cursor is persisted
 * after every page, so a crash or restart continues from the last completed
 * page rather than the start.
 */
export async function runLinearBackfill(
  prisma: PrismaClient,
  integrationId: string,
  options: { sinceDays?: number } = {},
): Promise<BackfillResult> {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: integrationId },
  });
  const cursor = ((integration.cursor as LinearCursor | null) ?? {}) as LinearCursor;
  const credentials = await loadFreshLinearCredentials(prisma, integrationId);
  const client = new LinearClient(credentials, {
    onUnauthorized: (failed) => markReauthRequired(prisma, integrationId, failed),
  });
  const sinceDays = options.sinceDays ?? DEFAULT_BACKFILL_DAYS;
  const defaultSince = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const runStartedAt = new Date();

  const result: BackfillResult = { issuesFetched: 0, historyEntriesFetched: 0, attachmentsFetched: 0 };

  await backfillIssues();

  cursor.backfillCompletedAt = new Date().toISOString();
  await persistCursor();

  return result;

  async function backfillIssues(): Promise<void> {
    const updatedSince = cursor.issues?.updatedSince ?? defaultSince.toISOString();
    let after = cursor.issues?.after;

    for (;;) {
      const page = await client.searchIssues(updatedSince, after);

      await writeRawEvents(page.nodes.map(mapIssueToRawEvent));
      result.issuesFetched += page.nodes.length;

      for (const issue of page.nodes) {
        result.historyEntriesFetched += await backfillHistoryForIssue(issue.id);
        result.attachmentsFetched += await backfillAttachmentsForIssue(issue.id);
      }

      after = page.pageInfo.endCursor;
      cursor.issues = { updatedSince, after };
      await persistCursor();

      if (!page.pageInfo.hasNextPage) break;
    }

    // The window just scanned is fully written; advance the watermark past it
    // so the next run's filter doesn't re-walk it. Mirrors Jira's updatedSince
    // becoming the next run's start.
    cursor.issues = { updatedSince: runStartedAt.toISOString(), after: undefined };
    await persistCursor();
  }

  async function backfillHistoryForIssue(issueId: string): Promise<number> {
    let after: string | undefined;
    let count = 0;

    for (;;) {
      const page = await client.fetchIssueHistory(issueId, after);
      await writeRawEvents(page.nodes.map((entry) => mapHistoryEntryToRawEvent(issueId, entry)));
      count += page.nodes.length;
      after = page.pageInfo.endCursor;

      if (!page.pageInfo.hasNextPage || page.nodes.length === 0) break;
    }

    return count;
  }

  async function backfillAttachmentsForIssue(issueId: string): Promise<number> {
    let after: string | undefined;
    let count = 0;

    for (;;) {
      const page = await client.fetchIssueAttachments(issueId, after);
      await writeRawEvents(page.nodes.map((attachment) => mapAttachmentToRawEvent(issueId, attachment)));
      count += page.nodes.length;
      after = page.pageInfo.endCursor;

      if (!page.pageInfo.hasNextPage || page.nodes.length === 0) break;
    }

    return count;
  }

  async function writeRawEvents(inputs: RawEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await prisma.rawEvent.createMany({
      data: inputs.map((input) => ({
        integrationId,
        providerEventId: input.providerEventId,
        sourceHash: input.sourceHash,
        payload: input.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  async function persistCursor(): Promise<void> {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { cursor: cursor as unknown as Prisma.InputJsonValue },
    });
  }
}
