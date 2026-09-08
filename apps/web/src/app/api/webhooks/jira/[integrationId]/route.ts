import { NextResponse } from "next/server";
import {
  extractJiraWebhookIssueKey,
  JiraApiError,
  JiraReauthRequiredError,
  runJiraCorrelation,
  runJiraNormalization,
  runJiraWebhookIngest,
  shouldIngestJiraWebhookEvent,
  verifyJiraWebhookSecret,
  type JiraWebhookPayload,
} from "@sla/jira";
import { getPrismaClient } from "@sla/db";
import { getJiraOAuthConfig } from "@/lib/jira-env";
import { runWebhookPipelineTail } from "@/lib/webhook-pipeline";

export const maxDuration = 60;

/**
 * Jira webhook receiver (roadmap step 20). Unauthenticated by session — Jira
 * calls this directly. Classic Jira webhooks (registered manually by the
 * customer under Jira admin: Settings > System > WebHooks — there is no
 * self-service REST registration under this app's read-only OAuth scope)
 * carry no HMAC the way Zendesk's do, so authenticity rests on a shared
 * secret the customer includes as `?secret=` in the URL they configure,
 * shown on the integrations settings page alongside the URL itself.
 *
 * On success this runs the full poll-cycle tail (ingest → correlate →
 * normalize → commitments → evaluation → notifications) for one issue,
 * synchronously — the 5-minute active-set poll and 60-minute reconciliation
 * sweep (roadmap step 7) keep running unchanged as the safety net for missed
 * or out-of-order deliveries.
 */
export async function POST(request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  const { integrationId } = await params;
  const prisma = getPrismaClient();

  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration || integration.provider !== "jira" || !integration.webhookSecret) {
    return NextResponse.json({ error: "Unknown webhook endpoint" }, { status: 404 });
  }

  const secret = new URL(request.url).searchParams.get("secret");
  if (!verifyJiraWebhookSecret(integration.webhookSecret, secret)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  // A disconnected integration has no credentials to ingest with — accept
  // the delivery (so it doesn't show as a failing webhook in Jira admin and
  // get retried forever) but do nothing with it.
  if (integration.status === "disconnected") {
    return NextResponse.json({ status: "ignored", reason: "integration disconnected" });
  }

  let payload: JiraWebhookPayload;
  try {
    payload = (await request.json()) as JiraWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!shouldIngestJiraWebhookEvent(payload)) {
    return NextResponse.json({ status: "ignored", reason: "event type not ingested" });
  }

  const issueKey = extractJiraWebhookIssueKey(payload);
  if (issueKey === null) {
    return NextResponse.json({ error: "No issue key found in webhook payload" }, { status: 400 });
  }

  let config;
  try {
    config = getJiraOAuthConfig();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jira OAuth is not configured" },
      { status: 500 },
    );
  }

  try {
    await runJiraWebhookIngest(prisma, integration.id, config, issueKey);
    await runJiraCorrelation(prisma, integration.id);
    await runJiraNormalization(prisma, integration.id);
    const pipeline = await runWebhookPipelineTail(prisma, integration.organizationId);

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    return NextResponse.json({ status: "processed", issueKey, ...pipeline });
  } catch (error) {
    // An issue the webhook referenced but that 404s on direct fetch (deleted
    // between the event firing and our fetch) is a normal race, not a
    // failure to retry.
    if (error instanceof JiraApiError && error.status === 404) {
      return NextResponse.json({ status: "ignored", reason: "issue not found" });
    }

    if (error instanceof JiraReauthRequiredError) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { status: "reauth_required", lastSyncAt: new Date(), lastSyncError: "Jira needs to be reconnected" },
      });
      // Accepted, not retried: reconnecting requires a human, which no
      // number of Jira retries will produce.
      return NextResponse.json({ status: "ignored", reason: "reauth required" });
    }

    const message = error instanceof Error ? error.message : String(error);
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), lastSyncError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
