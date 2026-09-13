import { getEmailSettings, EmailSettingsUnreadableError, type PrismaClient } from "@sla/db";
import { postMessage } from "@sla/slack";
import { sendEmail, type EmailConfig } from "@sla/email";
import type { NotificationCandidate } from "@sla/commitments";
import { formatSlackMessage, formatEmailMessage } from "./format";

function toEmailConfig(settings: NonNullable<Awaited<ReturnType<typeof getEmailSettings>>>): EmailConfig {
  return {
    host: settings.host,
    port: settings.port,
    security: settings.security,
    user: settings.username,
    password: settings.password,
    from: settings.fromEmail,
    fromName: settings.fromName,
  };
}

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
 * Email credentials are loaded per organization from `OrganizationEmailSettings`
 * (the settings UI, roadmap: organization SMTP configuration) rather than a
 * deployment-wide `.env` — there is no fallback to deployment-level SMTP
 * variables, matching `SlackIntegration`'s per-organization, nullable
 * pattern: an organization that hasn't saved SMTP configuration just gets
 * no email channel, an unattended worker must not crash-loop over it. A row
 * that exists but can't be decrypted (`EmailSettingsUnreadableError` — a
 * rotated/missing `SMTP_ENCRYPTION_KEY`, or corrupted ciphertext) is treated
 * the same as "not configured": still no crash, Slack (if ready) still
 * fires.
 */
export interface NotificationPipelineOptions {
  /** Deployment base URL (`NEXTAUTH_URL`) — used only to build a "View ticket" link in the branded HTML email. Omit (or leave unconfigured) and emails send without that link. */
  appUrl?: string | null;
}

export async function runNotificationPipeline(
  prisma: PrismaClient,
  organizationId: string,
  candidates: NotificationCandidate[],
  options: NotificationPipelineOptions = {},
): Promise<NotificationPipelineResult> {
  const result: NotificationPipelineResult = { notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: [] };
  if (candidates.length === 0) return result;

  const [slack, emailSettings] = await Promise.all([
    prisma.slackIntegration.findUnique({ where: { organizationId } }),
    getEmailSettings(prisma, organizationId).catch((error) => {
      if (error instanceof EmailSettingsUnreadableError) return null;
      throw error;
    }),
  ]);

  const slackReady = Boolean(slack?.channelId);
  const emailConfig = emailSettings ? toEmailConfig(emailSettings) : null;
  const recipients = emailConfig
    ? await prisma.user.findMany({ where: { organizationId }, select: { email: true } })
    : [];
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
    where: { id: { in: [...new Set(toSend.map((c) => c.caseId))] }, deletedAt: null },
    select: { id: true, externalId: true, subject: true, customer: { select: { name: true } } },
  });
  const caseById = new Map(caseRows.map((c) => [c.id, c]));

  for (const candidate of toSend) {
    const caseRow = caseById.get(candidate.caseId);
    if (!caseRow) continue;

    const context = { externalId: caseRow.externalId, customerName: caseRow.customer?.name ?? null, subject: caseRow.subject };
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
        const brand = {
          name: emailConfig!.fromName,
          caseUrl: options.appUrl ? `${options.appUrl}/cases/${caseRow.id}` : null,
        };
        const { subject, text, html } = formatEmailMessage(candidate, context, brand);
        await sendEmail(emailConfig!, { to: emailTo, subject, text, html });
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
