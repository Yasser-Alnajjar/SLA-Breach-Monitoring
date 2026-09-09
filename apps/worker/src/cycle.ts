import {
  runCommitmentPipeline,
  runEvaluationPipeline,
  type EvaluationPipelineResult,
  type EvaluationScope,
} from "@sla/commitments";
import { getIntegrationConfig, type PrismaClient } from "@sla/db";
import { JiraReauthRequiredError, runJiraBackfill, runJiraCorrelation, runJiraNormalization } from "@sla/jira";
import { LinearReauthRequiredError, runLinearBackfill, runLinearCorrelation, runLinearNormalization } from "@sla/linear";
import { runNotificationPipeline } from "@sla/notifications";
import {
  runZendeskBackfill,
  runZendeskBusinessCalendarImport,
  runZendeskNormalization,
  runZendeskSlaPolicyImport,
  ZendeskReauthRequiredError,
} from "@sla/zendesk";
import type { WorkerConfig } from "./config";

export type CycleKind = "active_set_poll" | "reconciliation_sweep";

export interface CycleResult {
  kind: CycleKind;
  organizationsProcessed: number;
  commitmentsCreated: number;
  commitmentsConsidered: number;
  evaluationsCreated: number;
  commitmentsFinalized: number;
  notificationsSent: number;
  failures: { organizationId: string; stage: string; error: string }[];
}

/**
 * The evaluation scope is what separates the two speeds. Ingestion itself is
 * the same call in both: the provider adapters fetch incrementally from the
 * cursor persisted on `Integration`, so a five-minute cycle naturally pulls
 * only what changed in those five minutes, and the hourly sweep re-runs the
 * identical call as a safety net — if an active-set cycle failed or was
 * delayed, the cursor is still behind and the sweep catches it up.
 */
const SCOPE_BY_KIND: Record<CycleKind, EvaluationScope> = {
  active_set_poll: "active",
  reconciliation_sweep: "all",
};

/**
 * One polling cycle across every organization: pull what changed from each
 * connected provider, project it into cases/commitments, then evaluate and
 * persist Evaluation rows (Phase 16). Failures are recorded per organization
 * and per stage rather than thrown — one broken integration must never stop
 * the other organizations in the same cycle from being evaluated.
 */
export async function runCycle(
  prisma: PrismaClient,
  config: WorkerConfig,
  kind: CycleKind,
): Promise<CycleResult> {
  const result: CycleResult = {
    kind,
    organizationsProcessed: 0,
    commitmentsCreated: 0,
    commitmentsConsidered: 0,
    evaluationsCreated: 0,
    commitmentsFinalized: 0,
    notificationsSent: 0,
    failures: [],
  };

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      // Disconnected integrations keep their row (never deleted — see the
      // Integration model's doc comment) but have no credentials left to
      // ingest with, so the cycle must not touch them.
      integrations: {
        where: { status: { not: "disconnected" } },
        select: { id: true, provider: true, credentials: true },
      },
    },
  });

  for (const organization of organizations) {
    result.organizationsProcessed += 1;

    for (const integration of organization.integrations) {
      let syncError: string | null = null;
      let reauthRequired = false;

      try {
        if (integration.provider === "zendesk") {
          if (!config.appUrl) continue;
          const zendeskConfig = await getIntegrationConfig(prisma, organization.id, "zendesk");
          if (!zendeskConfig) continue;
          await runZendeskBackfill(prisma, integration.id, {
            ...zendeskConfig,
            redirectUri: `${config.appUrl}/api/integrations/zendesk/callback`,
          });
          await runZendeskNormalization(prisma, integration.id);
          await runZendeskBusinessCalendarImport(prisma, integration.id);
          await runZendeskSlaPolicyImport(prisma, integration.id);
        } else if (integration.provider === "jira") {
          if (!config.appUrl) continue;
          const jiraConfig = await getIntegrationConfig(prisma, organization.id, "jira");
          if (!jiraConfig) continue;
          await runJiraBackfill(prisma, integration.id, {
            ...jiraConfig,
            redirectUri: `${config.appUrl}/api/integrations/jira/callback`,
          });
          await runJiraCorrelation(prisma, integration.id);
          await runJiraNormalization(prisma, integration.id);
        } else {
          // Linear's backfill needs no OAuth client config to run (roadmap
          // step 14: its tokens carry no refresh dance), unlike Jira/Zendesk.
          await runLinearBackfill(prisma, integration.id);
          await runLinearCorrelation(prisma, integration.id);
          await runLinearNormalization(prisma, integration.id);
        }
      } catch (error) {
        reauthRequired =
          error instanceof ZendeskReauthRequiredError ||
          error instanceof JiraReauthRequiredError ||
          error instanceof LinearReauthRequiredError;
        syncError = reauthRequired
          ? `${integration.provider[0]!.toUpperCase()}${integration.provider.slice(1)} needs to be reconnected`
          : error instanceof Error
            ? error.message
            : String(error);
        result.failures.push({ organizationId: organization.id, stage: `ingest:${integration.provider}`, error: syncError });
      }

      // Every attempted cycle (success or failure) updates sync health, so the
      // settings page reflects real state instead of only stdout logs.
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: syncError,
          ...(reauthRequired ? { status: "reauth_required" as const } : {}),
        },
      });
    }

    // Evaluation runs even when ingestion failed: time keeps passing, so a
    // commitment can cross a warn threshold or breach on already-stored events.
    try {
      const commitments = await runCommitmentPipeline(prisma, organization.id);
      result.commitmentsCreated += commitments.commitmentsCreated;
    } catch (error) {
      result.failures.push({
        organizationId: organization.id,
        stage: "commitments",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let notificationCandidates: EvaluationPipelineResult["notificationCandidates"] = [];
    try {
      const evaluations = await runEvaluationPipeline(prisma, organization.id, { scope: SCOPE_BY_KIND[kind] });
      result.commitmentsConsidered += evaluations.commitmentsConsidered;
      result.evaluationsCreated += evaluations.evaluationsCreated;
      result.commitmentsFinalized += evaluations.commitmentsFinalized;
      notificationCandidates = evaluations.notificationCandidates;
    } catch (error) {
      result.failures.push({
        organizationId: organization.id,
        stage: "evaluation",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Runs even for organizations with no Slack workspace connected and no
    // SMTP configured — runNotificationPipeline no-ops cheaply in that case.
    // A commitment that fails to notify never blocks another organization's
    // cycle.
    try {
      const notifications = await runNotificationPipeline(prisma, organization.id, notificationCandidates, config.email);
      result.notificationsSent += notifications.notificationsSent;
    } catch (error) {
      result.failures.push({
        organizationId: organization.id,
        stage: "notifications",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
