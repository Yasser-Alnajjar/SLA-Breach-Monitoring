import type { Prisma, PrismaClient } from "@sla/db";
import {
  evaluateCommitment,
  type BusinessCalendarVersion,
  type Commitment,
  type CommitmentKind,
  type CommitmentStatus,
  type Evaluation,
  type NormalizedEvent,
  type NormalizedEventType,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";

export interface CommitmentRecord {
  id: string;
  caseId: string;
  kind: CommitmentKind;
  policyVersionId: string;
  calendarVersionId: string;
  startedAt: Date;
  targetMinutes: number;
  dueAt: Date;
  status: CommitmentStatus;
  closedAt: Date | null;
}

export interface NormalizedEventRecord {
  id: string;
  caseId: string;
  type: string;
  occurredAt: Date;
  actor: string;
  system: string;
  fromState: string | null;
  toState: string | null;
  sourceRawEventId: string;
}

/** Maps a persisted Commitment row to packages/core's pure `Commitment`. */
export function toCommitmentDomain(row: CommitmentRecord): Commitment {
  return {
    id: row.id,
    caseId: row.caseId,
    kind: row.kind,
    policyVersionId: row.policyVersionId,
    calendarVersionId: row.calendarVersionId,
    startedAt: row.startedAt.toISOString(),
    targetMinutes: row.targetMinutes,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    closedAt: row.closedAt?.toISOString(),
  };
}

/** Maps a persisted NormalizedEvent row to packages/core's pure `NormalizedEvent`. */
export function toNormalizedEventDomain(
  row: NormalizedEventRecord,
): NormalizedEvent {
  return {
    id: row.id,
    caseId: row.caseId,
    type: row.type as NormalizedEventType,
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor as NormalizedEvent["actor"],
    system: row.system as NormalizedEvent["system"],
    fromState: row.fromState as NormalizedState | null,
    toState: row.toState as NormalizedState | null,
    sourceRawEventId: row.sourceRawEventId,
  };
}

/**
 * A Commitment is resolved once it has completed — `evaluation.clock.state`
 * is `stopped`: its first agent reply for first response, the case's close
 * for resolution (`findCompletionEvent` in packages/core). `met` if it
 * completed inside the target, `breached` if not. A `breached` status
 * without completion just means time ran out on a still-open commitment —
 * remaining evaluations must keep running so `breachedByMinutes` keeps
 * growing until it actually completes.
 */
export function isTerminalStatus(
  status: CommitmentStatus,
  completed: boolean,
): boolean {
  if (status === "met") return true;
  if (status === "breached") return completed;
  return false;
}

/**
 * An Evaluation is a snapshot worth keeping, not a heartbeat. `remainingMinutes`
 * is recomputable at any moment from the event stream (the schema's "store
 * events, never store computed time" rule), so a poll that finds nothing
 * changed writes nothing — otherwise every open commitment would accrue a row
 * every five minutes forever. What gets persisted is what later has to be
 * explained: the first evaluation, every status transition (the trigger
 * notifications key off in Phase 13.7), and the final snapshot recording the
 * magnitude a commitment ended up meeting or breaching by.
 */
export function shouldPersistEvaluation(
  status: CommitmentStatus,
  previousStatus: CommitmentStatus | null,
  terminal: boolean,
  alreadyFinalized: boolean,
): boolean {
  if (previousStatus === null) return true;
  if (status !== previousStatus) return true;
  return terminal && !alreadyFinalized;
}

/**
 * The provider's own id for each RawEvent an evaluation's `lastEvent` was
 * derived from (e.g. `ticket_audit:39016977009682`), so a persisted snapshot
 * names its source in the provider's terms too, not only by RawEvent row id.
 */
async function loadProviderEventIds(
  prisma: PrismaClient,
  evaluations: Evaluation[],
): Promise<Map<string, string>> {
  const rawEventIds = [
    ...new Set(
      evaluations.flatMap((e) =>
        e.inputs.lastEvent ? [e.inputs.lastEvent.sourceRawEventId] : [],
      ),
    ),
  ];
  if (rawEventIds.length === 0) return new Map();
  const rows = await prisma.rawEvent.findMany({
    where: { id: { in: rawEventIds } },
    select: { id: true, providerEventId: true },
  });
  return new Map(rows.map((row) => [row.id, row.providerEventId]));
}

/**
 * Maps an `evaluateCommitment` result onto an `evaluations` row: whole
 * seconds for durations (never truncated minutes), and `inputs.lastEvent` as
 * the stable source-event reference plus its provider event id when known.
 */
export function toEvaluationCreateInput(
  evaluation: Evaluation,
  providerEventIdByRawEventId: Map<string, string> = new Map(),
): Prisma.EvaluationCreateManyInput {
  const { lastEvent } = evaluation.inputs;
  const inputs = {
    ...evaluation.inputs,
    lastEvent: lastEvent
      ? {
          ...lastEvent,
          providerEventId:
            providerEventIdByRawEventId.get(lastEvent.sourceRawEventId) ?? null,
        }
      : null,
  };
  return {
    id: evaluation.id,
    commitmentId: evaluation.commitmentId,
    evaluatedAt: new Date(evaluation.evaluatedAt),
    elapsedSeconds: evaluation.elapsedSeconds,
    remainingSeconds: evaluation.remainingSeconds,
    status: evaluation.status,
    breachedBySeconds: evaluation.breachedBySeconds ?? null,
    inputs: inputs as unknown as Prisma.InputJsonValue,
  };
}

export type EvaluationScope = "active" | "all";

/**
 * A commitment whose evaluation this cycle crossed a `warnAtPercent`
 * threshold or breached (Phase 13.7). Deliberately collected for every
 * commitment evaluated, not only ones that get a persisted `Evaluation` row
 * (see `shouldPersistEvaluation`): a commitment can sit in `at_risk` for many
 * cycles while `warnThresholdCrossed` climbs 50 -> 80 -> 95 without its
 * coarse status ever changing, and each of those crossings is a distinct,
 * meaningful notification. Actual dedup against `(commitmentId, threshold)`
 * happens downstream, in @sla/notifications, via the `Notification` table's
 * unique constraint — this list is candidates, not guaranteed-new alerts.
 */
export interface NotificationCandidate {
  commitmentId: string;
  caseId: string;
  kind: CommitmentKind;
  status: CommitmentStatus;
  threshold: number;
  remainingMinutes: number;
  breachedByMinutes?: number;
}

export interface EvaluationPipelineResult {
  commitmentsConsidered: number;
  evaluationsCreated: number;
  commitmentsFinalized: number;
  commitmentsFailed: { commitmentId: string; error: string }[];
  notificationCandidates: NotificationCandidate[];
}

/**
 * Evaluates every Commitment in scope for an organization and persists the
 * resulting Evaluations (Phase 16: each poll cycle calls `evaluateCommitment`
 * and writes `Evaluation` rows). `scope: "active"` is the 5-minute
 * active-set poll — only commitments not yet finalized (`closedAt: null`).
 * `scope: "all"` is the 60-minute reconciliation sweep — re-checks every
 * commitment, including already-finalized ones, as a safety net against a
 * missed or failed active-set cycle. Only meaningful evaluations are written
 * (see `shouldPersistEvaluation`), and an Evaluation's id is a deterministic
 * hash of its inputs, so a re-run at the same `asOf` writes nothing twice.
 */
export async function runEvaluationPipeline(
  prisma: PrismaClient,
  organizationId: string,
  options: { asOf?: string; scope?: EvaluationScope } = {},
): Promise<EvaluationPipelineResult> {
  const asOf = options.asOf ?? new Date().toISOString();
  const scope = options.scope ?? "active";

  const result: EvaluationPipelineResult = {
    commitmentsConsidered: 0,
    evaluationsCreated: 0,
    commitmentsFinalized: 0,
    commitmentsFailed: [],
    notificationCandidates: [],
  };

  const commitmentRows = await prisma.commitment.findMany({
    where: {
      case: { organizationId, deletedAt: null },
      ...(scope === "active" ? { closedAt: null } : {}),
    },
  });
  result.commitmentsConsidered = commitmentRows.length;
  if (commitmentRows.length === 0) return result;

  const policyVersionIds = [
    ...new Set(commitmentRows.map((c) => c.policyVersionId)),
  ];
  const calendarVersionIds = [
    ...new Set(commitmentRows.map((c) => c.calendarVersionId)),
  ];
  const caseIds = [...new Set(commitmentRows.map((c) => c.caseId))];

  const [
    policyVersionRows,
    calendarVersionRows,
    eventRows,
    latestEvaluationRows,
  ] = await Promise.all([
    prisma.sLAPolicyVersion.findMany({
      where: { id: { in: policyVersionIds } },
    }),
    prisma.businessCalendarVersion.findMany({
      where: { id: { in: calendarVersionIds } },
    }),
    prisma.normalizedEvent.findMany({ where: { caseId: { in: caseIds } } }),
    prisma.evaluation.findMany({
      where: { commitmentId: { in: commitmentRows.map((c) => c.id) } },
      distinct: ["commitmentId"],
      orderBy: [{ commitmentId: "asc" }, { evaluatedAt: "desc" }],
      select: { commitmentId: true, status: true },
    }),
  ]);

  const previousStatusByCommitmentId = new Map<string, CommitmentStatus>(
    latestEvaluationRows.map((row) => [row.commitmentId, row.status]),
  );

  const policyVersionsById = new Map<string, SLAPolicyVersion>(
    policyVersionRows.map((row) => [
      row.id,
      {
        id: row.id,
        policyId: row.policyId,
        version: row.version,
        match: row.match as SLAPolicyMatch,
        targets: row.targets as { kind: CommitmentKind; minutes: number }[],
        pauseOnStates: row.pauseOnStates as NormalizedState[],
        calendarVersionId: row.calendarVersionId,
        warnAtPercent: row.warnAtPercent,
        effectiveFrom: row.effectiveFrom.toISOString(),
      },
    ]),
  );

  const calendarsById = new Map<string, BusinessCalendarVersion>(
    calendarVersionRows.map((row) => [
      row.id,
      {
        id: row.id,
        version: row.version,
        timezone: row.timezone,
        weekly: row.weekly as unknown as WeeklyWindow[],
        holidays: row.holidays,
        alwaysOpen: row.alwaysOpen,
      },
    ]),
  );

  const eventsByCaseId = new Map<string, NormalizedEvent[]>();
  for (const row of eventRows) {
    const domainEvent = toNormalizedEventDomain(row);
    const existing = eventsByCaseId.get(row.caseId);
    if (existing) existing.push(domainEvent);
    else eventsByCaseId.set(row.caseId, [domainEvent]);
  }

  const evaluationsToCreate: Evaluation[] = [];
  const commitmentUpdates: {
    id: string;
    status: CommitmentStatus;
    closedAt: string | null;
  }[] = [];

  for (const row of commitmentRows) {
    try {
      const policyVersion = policyVersionsById.get(row.policyVersionId);
      if (!policyVersion)
        throw new Error(
          `No SLAPolicyVersion loaded for ${row.policyVersionId}`,
        );
      const calendarVersion = calendarsById.get(row.calendarVersionId);
      if (!calendarVersion)
        throw new Error(
          `No BusinessCalendarVersion loaded for ${row.calendarVersionId}`,
        );

      const caseEvents = eventsByCaseId.get(row.caseId) ?? [];
      const commitment = toCommitmentDomain(row);
      const evaluation = evaluateCommitment(
        commitment,
        caseEvents,
        policyVersion,
        calendarVersion,
        asOf,
      );

      const terminal = isTerminalStatus(
        evaluation.status,
        evaluation.clock.state === "stopped",
      );
      const finalized = row.closedAt !== null;

      if (evaluation.warnThresholdCrossed !== undefined) {
        result.notificationCandidates.push({
          commitmentId: row.id,
          caseId: row.caseId,
          kind: row.kind,
          status: evaluation.status,
          threshold: evaluation.warnThresholdCrossed,
          remainingMinutes: evaluation.remainingMinutes,
          breachedByMinutes: evaluation.breachedByMinutes,
        });
      }

      if (
        shouldPersistEvaluation(
          evaluation.status,
          previousStatusByCommitmentId.get(row.id) ?? null,
          terminal,
          finalized,
        )
      ) {
        evaluationsToCreate.push(evaluation);
      }

      // A finalized commitment keeps its original closedAt when a later
      // evaluation revises its status, and loses it when it is no longer
      // terminal (its case was reopened), so the active-set poll picks it
      // back up instead of leaving it to the hourly reconciliation sweep.
      if (evaluation.status !== row.status || terminal !== finalized) {
        commitmentUpdates.push({
          id: row.id,
          status: evaluation.status,
          closedAt: terminal
            ? (row.closedAt?.toISOString() ?? evaluation.evaluatedAt)
            : null,
        });
        if (terminal && !finalized) result.commitmentsFinalized += 1;
      }
    } catch (error) {
      result.commitmentsFailed.push({
        commitmentId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (evaluationsToCreate.length > 0) {
    const providerEventIdByRawEventId = await loadProviderEventIds(
      prisma,
      evaluationsToCreate,
    );
    const created = await prisma.evaluation.createMany({
      data: evaluationsToCreate.map((evaluation) =>
        toEvaluationCreateInput(evaluation, providerEventIdByRawEventId),
      ),
      skipDuplicates: true,
    });
    result.evaluationsCreated = created.count;
  }

  for (const update of commitmentUpdates) {
    await prisma.commitment.update({
      where: { id: update.id },
      data: {
        status: update.status,
        closedAt: update.closedAt ? new Date(update.closedAt) : null,
      },
    });
  }

  return result;
}
