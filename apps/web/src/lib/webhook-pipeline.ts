import { runCommitmentPipeline, runEvaluationPipeline } from "@sla/commitments";
import { runNotificationPipeline } from "@sla/notifications";
import type { PrismaClient } from "@sla/db";

export interface WebhookPipelineResult {
  commitmentsCreated: number;
  commitmentsConsidered: number;
  evaluationsCreated: number;
  commitmentsFinalized: number;
  notificationsSent: number;
  notificationsFailed: { commitmentId: string; threshold: number; error: string }[];
}

/**
 * The commitment/evaluation/notification tail of one worker cycle
 * (`apps/worker/src/cycle.ts`'s per-organization body), run synchronously
 * right after a webhook receiver ingests one fresh ticket/issue — this is
 * what actually "closes the gap" roadmap step 20 is for: writing a RawEvent
 * alone does nothing until something re-evaluates commitments and dispatches
 * alerts. Scoped to `active` evaluation, same as the 5-minute poll, since a
 * webhook is inherently about one already-open case, not a full sweep.
 * Notification dedup is safe under concurrent execution with the worker's
 * own cycle: both paths go through the same `@@unique([commitmentId,
 * threshold])`-guarded `runNotificationPipeline`.
 */
export async function runWebhookPipelineTail(
  prisma: PrismaClient,
  organizationId: string,
): Promise<WebhookPipelineResult> {
  const commitments = await runCommitmentPipeline(prisma, organizationId);
  const evaluations = await runEvaluationPipeline(prisma, organizationId, { scope: "active" });
  const notifications = await runNotificationPipeline(prisma, organizationId, evaluations.notificationCandidates);

  return {
    commitmentsCreated: commitments.commitmentsCreated,
    commitmentsConsidered: evaluations.commitmentsConsidered,
    evaluationsCreated: evaluations.evaluationsCreated,
    commitmentsFinalized: evaluations.commitmentsFinalized,
    notificationsSent: notifications.notificationsSent,
    notificationsFailed: notifications.notificationsFailed,
  };
}
