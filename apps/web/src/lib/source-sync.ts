import type { PrismaClient } from "@sla/db";
import {
  runCommitmentPipeline,
  runCommitmentReResolutionPipeline,
  runEvaluationPipeline,
  runNextReplyCyclePipeline,
  type CommitmentPipelineResult,
  type CommitmentReResolutionResult,
  type EvaluationPipelineResult,
  type NextReplyCyclePipelineResult,
} from "@sla/commitments";
import {
  runZendeskBusinessCalendarImport,
  runZendeskNormalization,
  runZendeskSlaPolicyImport,
  type BusinessCalendarImportResult,
  type NormalizationResult,
  type SlaPolicyImportResult,
  type ZendeskCursor,
} from "@sla/zendesk";
import {
  runJiraCorrelation,
  runJiraNormalization,
  type CorrelationResult,
  type JiraCursor,
  type JiraNormalizationResult,
} from "@sla/jira";

/**
 * The sources the onboarding backfill routes pull from. Their event sets
 * together are what a Zendesk case's commitments get evaluated against, so
 * neither route may finalize a commitment while the other's first backfill
 * is still outstanding.
 */
type SourceProvider = "zendesk" | "jira";

// Generous on purpose: a route queued behind the other's projection waits
// inside this transaction, and only the lock (no rows) is held meanwhile.
const LOCK_WAIT_TIMEOUT_MS = 15 * 60_000;

export interface SourceSyncProjectionResult {
  zendesk: {
    normalization: NormalizationResult;
    businessCalendarImport: BusinessCalendarImportResult;
    slaPolicyImport: SlaPolicyImportResult;
  } | null;
  jira: { correlation: CorrelationResult; normalization: JiraNormalizationResult } | null;
  commitments: CommitmentPipelineResult;
  reResolution: CommitmentReResolutionResult;
  /**
   * Unlike `evaluation`, never deferred by `pendingProviders`: Next Reply
   * cycles are derived only from the case's own ticket-source events
   * (zendesk/intercom), never Jira's, so an outstanding Jira backfill has no
   * bearing on them — same treatment as `commitments`.
   */
  nextReplyCycles: NextReplyCyclePipelineResult;
  /** Null while `pendingProviders` is non-empty — evaluation is deferred, not skipped. */
  evaluation: EvaluationPipelineResult | null;
  pendingProviders: SourceProvider[];
}

/**
 * Runs `work` while holding a per-organization Postgres advisory lock, so the
 * Zendesk and Jira backfill routes (which onboarding fires concurrently)
 * never project into Case/NormalizedEvent/Commitment at the same time. The
 * lock belongs to an otherwise idle transaction and is released when it
 * ends; `work` itself uses the regular client, since the pipelines open
 * their own transactions.
 */
async function withSourceSyncLock<T>(
  prisma: PrismaClient,
  organizationId: string,
  work: () => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`source-sync:${organizationId}`}, 0))`;
      return work();
    },
    { maxWait: 10_000, timeout: LOCK_WAIT_TIMEOUT_MS },
  );
}

/**
 * The DB-only tail of a Zendesk or Jira backfill: project stored RawEvents
 * into cases and events, create commitments, and — once every connected
 * source has completed its first backfill — evaluate them with the same
 * `runEvaluationPipeline` the worker and webhook path use, so a fresh connect
 * doesn't leave commitments at their `on_track`/unfinalized defaults until
 * the worker's next poll.
 *
 * Mirrors the worker cycle's order (Zendesk, then Jira, then commitments,
 * then commitment re-resolution, then Next Reply cycles, then evaluation).
 * Every source whose backfill has
 * completed is re-projected from its stored RawEvents, not just the
 * caller's: the other route may have fetched without projecting yet, or run
 * Jira correlation before Zendesk's cases existed. All steps are idempotent,
 * so the redundant pass is harmless.
 *
 * Evaluation uses the reconciliation scope ("all"): a commitment finalized
 * before Jira was connected is re-checked against the now-complete event set
 * rather than left on its earlier result. Commitment creation and Next Reply
 * cycle derivation both run unconditionally, not gated by `pendingProviders`
 * like evaluation is — see `nextReplyCycles` above for why that's safe.
 *
 * One `asOf` snapshot covers commitment creation, cycle derivation, and
 * evaluation, so all three agree on "now" for this sync.
 */
export async function projectAndEvaluateSourceSyncs(
  prisma: PrismaClient,
  organizationId: string,
): Promise<SourceSyncProjectionResult> {
  return withSourceSyncLock(prisma, organizationId, async () => {
    const integrations = await prisma.integration.findMany({
      where: { organizationId, provider: { in: ["zendesk", "jira"] }, status: { not: "disconnected" } },
      select: { id: true, provider: true, cursor: true },
    });
    const zendesk = integrations.find((i) => i.provider === "zendesk");
    const jira = integrations.find((i) => i.provider === "jira");
    const zendeskReady = (zendesk?.cursor as ZendeskCursor | null)?.backfillCompletedAt != null;
    const jiraReady = (jira?.cursor as JiraCursor | null)?.backfillCompletedAt != null;

    const pendingProviders: SourceProvider[] = [];
    if (!zendeskReady) pendingProviders.push("zendesk");
    if (jira && !jiraReady) pendingProviders.push("jira");

    const zendeskResult =
      zendesk && zendeskReady
        ? {
            normalization: await runZendeskNormalization(prisma, zendesk.id),
            businessCalendarImport: await runZendeskBusinessCalendarImport(prisma, zendesk.id),
            slaPolicyImport: await runZendeskSlaPolicyImport(prisma, zendesk.id),
          }
        : null;
    const jiraResult =
      jira && jiraReady
        ? {
            correlation: await runJiraCorrelation(prisma, jira.id),
            normalization: await runJiraNormalization(prisma, jira.id),
          }
        : null;

    const asOf = new Date().toISOString();

    const commitments = await runCommitmentPipeline(prisma, organizationId);
    const reResolution = await runCommitmentReResolutionPipeline(prisma, organizationId, { asOf });
    const nextReplyCycles = await runNextReplyCyclePipeline(prisma, organizationId, { asOf });
    const evaluation =
      pendingProviders.length === 0
        ? await runEvaluationPipeline(prisma, organizationId, { asOf, scope: "all" })
        : null;

    return {
      zendesk: zendeskResult,
      jira: jiraResult,
      commitments,
      reResolution,
      nextReplyCycles,
      evaluation,
      pendingProviders,
    };
  });
}
