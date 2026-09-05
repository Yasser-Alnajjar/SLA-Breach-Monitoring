import type { Prisma, PrismaClient } from "@sla/db";
import { JiraClient } from "./client";
import {
  mapChangelogHistoryToRawEvent,
  mapIssueToRawEvent,
  mapRemoteLinkToRawEvent,
  type RawEventInput,
} from "./rawEvents";
import type { JiraCredentials, JiraCursor, JiraSearchPage } from "./types";

const DEFAULT_BACKFILL_DAYS = 90;

export interface BackfillResult {
  issuesFetched: number;
  changelogHistoriesFetched: number;
  remoteLinksFetched: number;
}

/**
 * Pulls issues, changelog histories, and remote links into RawEvent. Raw
 * ingestion only — normalization and correlation land in roadmap step 5.
 * Resumable: the cursor is persisted after every page, so a crash or restart
 * continues from the last completed page rather than the start.
 */
export async function runJiraBackfill(
  prisma: PrismaClient,
  integrationId: string,
  credentials: JiraCredentials,
  options: { sinceDays?: number } = {},
): Promise<BackfillResult> {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: integrationId },
  });
  const cursor = ((integration.cursor as JiraCursor | null) ?? {}) as JiraCursor;
  const client = new JiraClient(credentials);
  const sinceDays = options.sinceDays ?? DEFAULT_BACKFILL_DAYS;
  const defaultSince = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const runStartedAt = new Date();

  const result: BackfillResult = {
    issuesFetched: 0,
    changelogHistoriesFetched: 0,
    remoteLinksFetched: 0,
  };

  await backfillIssues();

  cursor.backfillCompletedAt = new Date().toISOString();
  await persistCursor();

  return result;

  async function backfillIssues(): Promise<void> {
    const updatedSince = cursor.issues?.updatedSince ?? defaultSince.toISOString();
    let startAt = cursor.issues?.startAt ?? 0;
    const jql = `updated >= "${formatJqlDateTime(new Date(updatedSince))}" ORDER BY updated ASC`;

    for (;;) {
      const page: JiraSearchPage = await client.searchIssues(jql, startAt);

      await writeRawEvents(page.issues.map(mapIssueToRawEvent));
      result.issuesFetched += page.issues.length;

      for (const issue of page.issues) {
        result.changelogHistoriesFetched += await backfillChangelogForIssue(issue.key);
        result.remoteLinksFetched += await backfillRemoteLinksForIssue(issue.key);
      }

      startAt += page.issues.length;
      cursor.issues = { updatedSince, startAt };
      await persistCursor();

      if (page.issues.length === 0 || startAt >= page.total) break;
    }

    // The window just scanned is fully written; advance the watermark past it
    // so the next run's JQL doesn't re-walk it. Mirrors Zendesk's end_time
    // becoming the next start_time.
    cursor.issues = { updatedSince: runStartedAt.toISOString(), startAt: 0 };
    await persistCursor();
  }

  async function backfillChangelogForIssue(issueKey: string): Promise<number> {
    let startAt = 0;
    let count = 0;

    for (;;) {
      const page = await client.fetchChangelogPage(issueKey, startAt);
      await writeRawEvents(page.values.map((history) => mapChangelogHistoryToRawEvent(issueKey, history)));
      count += page.values.length;
      startAt += page.values.length;

      if (page.isLast || page.values.length === 0) break;
    }

    return count;
  }

  async function backfillRemoteLinksForIssue(issueKey: string): Promise<number> {
    const links = await client.fetchRemoteLinks(issueKey);
    await writeRawEvents(links.map((link) => mapRemoteLinkToRawEvent(issueKey, link)));
    return links.length;
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

/** Jira JQL's quoted date-time literal format: `yyyy/MM/dd HH:mm`, in UTC. */
export function formatJqlDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}
