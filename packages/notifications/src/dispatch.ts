import type { PrismaClient } from "@sla/db";
import { postMessage } from "@sla/slack";
import { sendEmail, type EmailConfig } from "@sla/email";
import type { NotificationCandidate } from "@sla/commitments";
import { formatSlackMessage, formatEmailMessage } from "./format";

export interface NotificationPipelineResult {
  notificationsSent: number;
  // Not connected, no channel/recipients configured yet, or already sent for
  // that (commitmentId, threshold) — the common, expected case once a
  // commitment has settled at a given threshold.
  notificationsSkipped: number;
  notificationsFailed: { commitmentId: string; threshold: number; error: string }[];
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends Slack and/or email alerts for notification candidates surfaced by
 * `runEvaluationPipeline` (Phase 13.7). Both channels share one dedup slot:
 * the `Notification` table's `@@unique([commitmentId, threshold])`
 * constraint guards "has this alert been dispatched at all", not
 * per-channel, so a candidate is attempted on every configured channel
 * *before* the single row for it is written — that keeps a second channel
 * from reading the first channel's row as "already sent" and silently
 * skipping itself. `channel` records which channels actually delivered
 * (e.g. `"slack,email"`), and an in-memory pre-check against existing rows
 * avoids needless network calls on later cycles; the unique constraint
 * itself is the real guarantee — a `P2002` on the post-send `create` means
 * some other cycle already recorded this exact alert, so it's counted as
 * skipped rather than failed.
 *
 * `emailConfig` is nullable the same way `WorkerConfig.email` is: an
 * unattended worker must not crash-loop an install that never set SMTP
 * credentials, it should just skip that channel.
 */
export async function runNotificationPipeline(
  prisma: PrismaClient,
  organizationId: string,
  candidates: NotificationCandidate[],
  emailConfig: EmailConfig | null = null,
): Promise<NotificationPipelineResult> {
  const result: NotificationPipelineResult = { notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: [] };
  if (candidates.length === 0) return result;

  const [slack, recipients] = await Promise.all([
    prisma.slackIntegration.findUnique({ where: { organizationId } }),
    emailConfig ? prisma.user.findMany({ where: { organizationId }, select: { email: true } }) : Promise.resolve([]),
  ]);

  const slackReady = Boolean(slack?.channelId);
  const emailTo = recipients.map((r) => r.email);
  const emailReady = Boolean(emailConfig) && emailTo.length > 0;

  if (!slackReady && !emailReady) {
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

    const context = { externalId: caseRow.externalId, customerName: caseRow.customer?.name ?? null };
    const delivered: string[] = [];
    const errors: string[] = [];

    if (slackReady) {
      try {
        await postMessage(slack!.accessToken, slack!.channelId!, formatSlackMessage(candidate, context));
        delivered.push("slack");
      } catch (error) {
        errors.push(`slack: ${errorMessage(error)}`);
      }
    }

    if (emailReady) {
      try {
        const { subject, text } = formatEmailMessage(candidate, context);
        await sendEmail(emailConfig!, { to: emailTo, subject, text });
        delivered.push("email");
      } catch (error) {
        errors.push(`email: ${errorMessage(error)}`);
      }
    }

    if (delivered.length === 0) {
      result.notificationsFailed.push({ commitmentId: candidate.commitmentId, threshold: candidate.threshold, error: errors.join("; ") });
      continue;
    }

    try {
      await prisma.notification.create({
        data: { commitmentId: candidate.commitmentId, threshold: candidate.threshold, channel: delivered.join(",") },
      });
      result.notificationsSent += 1;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      result.notificationsSkipped += 1;
    }
  }

  return result;
}
