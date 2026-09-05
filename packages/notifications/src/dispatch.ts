import type { PrismaClient } from "@sla/db";
import { postMessage } from "@sla/slack";
import type { NotificationCandidate } from "@sla/commitments";
import { formatSlackMessage } from "./format";

export interface NotificationPipelineResult {
  notificationsSent: number;
  // Not connected, no channel chosen yet, or already sent for that
  // (commitmentId, threshold) — the common, expected case once a commitment
  // has settled at a given threshold.
  notificationsSkipped: number;
  notificationsFailed: { commitmentId: string; threshold: number; error: string }[];
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Sends Slack alerts for notification candidates surfaced by
 * `runEvaluationPipeline` (Phase 13.7). Dedup is two-layered: an in-memory
 * pre-check against already-sent `(commitmentId, threshold)` pairs avoids
 * needless Slack calls, and the `Notification` table's unique constraint is
 * the actual guarantee — a `P2002` on the post-send `create` means some
 * other cycle already recorded (and therefore already sent) this exact
 * alert, so it's counted as skipped rather than failed.
 */
export async function runNotificationPipeline(
  prisma: PrismaClient,
  organizationId: string,
  candidates: NotificationCandidate[],
): Promise<NotificationPipelineResult> {
  const result: NotificationPipelineResult = { notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: [] };
  if (candidates.length === 0) return result;

  const slack = await prisma.slackIntegration.findUnique({ where: { organizationId } });
  if (!slack || !slack.channelId) {
    result.notificationsSkipped = candidates.length;
    return result;
  }

  const existing = await prisma.notification.findMany({
    where: { commitmentId: { in: candidates.map((c) => c.commitmentId) } },
    select: { commitmentId: true, threshold: true },
  });
  const alreadySent = new Set(existing.map((e) => `${e.commitmentId}:${e.threshold}`));
  const toSend = candidates.filter((c) => !alreadySent.has(`${c.commitmentId}:${c.threshold}`));
  result.notificationsSkipped += candidates.length - toSend.length;
  if (toSend.length === 0) return result;

  const caseRows = await prisma.case.findMany({
    where: { id: { in: [...new Set(toSend.map((c) => c.caseId))] } },
    select: { id: true, externalId: true, customer: { select: { name: true } } },
  });
  const caseById = new Map(caseRows.map((c) => [c.id, c]));

  for (const candidate of toSend) {
    const caseRow = caseById.get(candidate.caseId);
    if (!caseRow) continue;

    const text = formatSlackMessage(candidate, {
      externalId: caseRow.externalId,
      customerName: caseRow.customer?.name ?? null,
    });

    try {
      await postMessage(slack.accessToken, slack.channelId, text);
    } catch (error) {
      result.notificationsFailed.push({
        commitmentId: candidate.commitmentId,
        threshold: candidate.threshold,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    try {
      await prisma.notification.create({
        data: { commitmentId: candidate.commitmentId, threshold: candidate.threshold, channel: "slack" },
      });
      result.notificationsSent += 1;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      result.notificationsSkipped += 1;
    }
  }

  return result;
}
