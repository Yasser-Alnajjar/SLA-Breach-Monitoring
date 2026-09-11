import type { Prisma, PrismaClient } from "@sla/db";
import { GithubClient } from "./client";
import { mapPullRequestToRawEvent, mapTimelineItemToRawEvent, type RawEventInput } from "./rawEvents";
import { loadFreshGithubCredentials, markReauthRequired } from "./tokenLifecycle";
import type { GithubCursor } from "./types";

const DEFAULT_BACKFILL_DAYS = 90;

export interface BackfillResult {
  pullRequestsFetched: number;
  timelineItemsFetched: number;
}

/**
 * Pulls pull requests and their timelines (review requested, reviewed,
 * merged, closed, reopened) into RawEvent. Raw ingestion only —
 * normalization and correlation are separate steps. Resumable: the cursor
 * is persisted after every page, so a crash or restart continues from the
 * last completed page rather than the start.
 *
 * Scoped to the single `owner/repo` this integration was connected with —
 * GitHub's search API also caps results around 1000 per query, an accepted
 * limitation for a single repo's pull request volume in v1.
 */
export async function runGithubBackfill(
  prisma: PrismaClient,
  integrationId: string,
  options: { sinceDays?: number } = {},
): Promise<BackfillResult> {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: integrationId },
  });
  const { owner, repo } = integration.credentials as unknown as { owner: string; repo: string };
  const cursor = ((integration.cursor as GithubCursor | null) ?? {}) as GithubCursor;
  const credentials = await loadFreshGithubCredentials(prisma, integrationId);
  const client = new GithubClient(credentials, {
    onUnauthorized: (failed) => markReauthRequired(prisma, integrationId, failed),
  });
  const sinceDays = options.sinceDays ?? DEFAULT_BACKFILL_DAYS;
  const defaultSince = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const runStartedAt = new Date();

  const result: BackfillResult = { pullRequestsFetched: 0, timelineItemsFetched: 0 };

  await backfillPullRequests();

  cursor.backfillCompletedAt = new Date().toISOString();
  await persistCursor();

  return result;

  async function backfillPullRequests(): Promise<void> {
    const updatedSince = cursor.pullRequests?.updatedSince ?? defaultSince.toISOString();
    let after = cursor.pullRequests?.after;

    for (;;) {
      const page = await client.searchPullRequests(owner, repo, updatedSince, after);

      await writeRawEvents(page.nodes.map((pr) => mapPullRequestToRawEvent(owner, repo, pr)));
      result.pullRequestsFetched += page.nodes.length;

      for (const pr of page.nodes) {
        result.timelineItemsFetched += await backfillTimelineForPullRequest(pr.id, pr.number);
      }

      after = page.pageInfo.endCursor;
      cursor.pullRequests = { updatedSince, after };
      await persistCursor();

      if (!page.pageInfo.hasNextPage) break;
    }

    // The window just scanned is fully written; advance the watermark past
    // it so the next run's filter doesn't re-walk it. Mirrors Jira's
    // updatedSince becoming the next run's start.
    cursor.pullRequests = { updatedSince: runStartedAt.toISOString(), after: undefined };
    await persistCursor();
  }

  async function backfillTimelineForPullRequest(pullRequestId: string, prNumber: number): Promise<number> {
    let after: string | undefined;
    let count = 0;

    for (;;) {
      const page = await client.fetchTimelineItems(pullRequestId, after);
      await writeRawEvents(page.nodes.map((item) => mapTimelineItemToRawEvent(owner, repo, prNumber, item)));
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
