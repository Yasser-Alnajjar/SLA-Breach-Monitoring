import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@sla/db";
import { JiraClient } from "./client";
import type { JiraOAuthConfig } from "./oauth";
import {
  mapChangelogHistoryToRawEvent,
  mapIssueToRawEvent,
  mapRemoteLinkToRawEvent,
  mapStatusToRawEvent,
  type RawEventInput,
} from "./rawEvents";
import { loadFreshJiraCredentials, refreshAfterUnauthorized } from "./tokenLifecycle";

/** Random per-integration secret, generated once at connect and never rotated on reconnect (see Integration.webhookSecret's doc comment). */
export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Classic Jira webhooks (registered manually in Jira admin — there is no
 * self-service REST registration under the read-only OAuth scope this app
 * requests) carry no HMAC signature the way Zendesk's do, so authenticity is
 * verified via a shared secret the customer includes as a `?secret=` query
 * parameter on the webhook URL they configure. Constant-time compare so a
 * partial match can't be timed out of the endpoint.
 */
export function verifyJiraWebhookSecret(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Jira classic webhook events this receiver acts on. `jira:issue_deleted`
 * (and anything else Jira might send to the same URL) is accepted but
 * ignored — the issue is gone by the time a refetch would run, and deletion
 * handling is out of scope here the same way it is for the poller.
 */
const INGESTIBLE_EVENTS = new Set(["jira:issue_created", "jira:issue_updated"]);

export interface JiraWebhookPayload {
  webhookEvent?: string;
  issue?: { key?: string };
}

export function shouldIngestJiraWebhookEvent(payload: JiraWebhookPayload): boolean {
  return typeof payload.webhookEvent === "string" && INGESTIBLE_EVENTS.has(payload.webhookEvent);
}

export function extractJiraWebhookIssueKey(payload: JiraWebhookPayload): string | null {
  const key = payload.issue?.key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

export interface WebhookIngestResult {
  issuesFetched: number;
  changelogHistoriesFetched: number;
  remoteLinksFetched: number;
  statusesFetched: number;
}

/**
 * Targeted refetch of one issue, triggered by an inbound webhook (roadmap
 * step 20) rather than the JQL-windowed search the two-speed poller uses.
 * Deliberately never touches Integration.cursor — that watermark belongs to
 * the incremental search stream `runJiraBackfill` advances. Writes land
 * through the same RawEvent mapping functions the poller uses, so a
 * subsequent `runJiraCorrelation`/`runJiraNormalization` call picks them up
 * identically whether the issue arrived via poll or webhook.
 *
 * Also refetches the site's full status list, same as `runJiraBackfill`'s
 * `backfillStatuses`: a tenant can add a custom status and transition an
 * issue onto it between poll cycles, and the synchronous
 * `runJiraNormalization` this feeds into (see the webhook route) needs that
 * status id resolvable *now* — otherwise the issue's events fail to
 * normalize and its Timeline silently stops updating until the next poll.
 */
export async function runJiraWebhookIngest(
  prisma: PrismaClient,
  integrationId: string,
  config: JiraOAuthConfig,
  issueKey: string,
): Promise<WebhookIngestResult> {
  const credentials = await loadFreshJiraCredentials(prisma, integrationId, config);
  const client = new JiraClient(credentials, {
    onUnauthorized: (failed) => refreshAfterUnauthorized(prisma, integrationId, config, failed),
  });

  const statuses = await client.fetchStatuses();
  const issue = await client.fetchIssue(issueKey);
  const rawEvents: RawEventInput[] = [...statuses.map(mapStatusToRawEvent), mapIssueToRawEvent(issue)];

  let changelogHistoriesFetched = 0;
  let startAt = 0;
  for (;;) {
    const page = await client.fetchChangelogPage(issueKey, startAt);
    rawEvents.push(...page.values.map((history) => mapChangelogHistoryToRawEvent(issueKey, history)));
    changelogHistoriesFetched += page.values.length;
    startAt += page.values.length;
    if (page.isLast || page.values.length === 0) break;
  }

  const remoteLinks = await client.fetchRemoteLinks(issueKey);
  rawEvents.push(...remoteLinks.map((link) => mapRemoteLinkToRawEvent(issueKey, link)));

  await prisma.rawEvent.createMany({
    data: rawEvents.map((input) => ({
      integrationId,
      providerEventId: input.providerEventId,
      sourceHash: input.sourceHash,
      payload: input.payload as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });

  return {
    issuesFetched: 1,
    changelogHistoriesFetched,
    remoteLinksFetched: remoteLinks.length,
    statusesFetched: statuses.length,
  };
}
