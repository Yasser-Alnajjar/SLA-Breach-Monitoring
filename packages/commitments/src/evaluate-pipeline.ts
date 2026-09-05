import type { Prisma, PrismaClient } from "@sla/db";
import {
  evaluateCommitment,
  type BusinessCalendarVersion,
  type Commitment,
  type CommitmentKind,
  type CommitmentStatus,
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
export function toNormalizedEventDomain(row: NormalizedEventRecord): NormalizedEvent {
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
 * Whether a `case_closed` event has occurred at or before `asOf` — mirrors
 * the cutoff `evaluateCommitment` itself applies (packages/core/evaluate.ts)
 * so the pipeline can tell a truly final evaluation (the case closed) apart
 * from a commitment that merely reads as "breached" right now because time
 * ran out on an still-open case.
 */
export function hasCaseClosedEvent(events: { type: string; occurredAt: string }[], asOf: string): boolean {
  return events.some((e) => e.type === "case_closed" && e.occurredAt <= asOf);
}

/**
 * A Commitment is permanently resolved once the case that owns it has
 * closed: `met` if it closed inside the target, `breached` if not. A
 * `breached` status without a close event just means time ran out on a
 * still-open case — remaining evaluations must keep running so
 * `breachedByMinutes` keeps growing until the case actually closes.
 */
export function isTerminalStatus(status: CommitmentStatus, caseClosed: boolean): boolean {
  if (status === "met") return true;
  if (status === "breached") return caseClosed;
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

export type EvaluationScope = "active" | "all";

export interface EvaluationPipelineResult {
  commitmentsConsidered: number;
  evaluationsCreated: number;
  commitmentsFinalized: number;
  commitmentsFailed: { commitmentId: string; error: string }[];
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
  };

  const commitmentRows = await prisma.commitment.findMany({
    where: {
      case: { organizationId },
      ...(scope === "active" ? { closedAt: null } : {}),
    },
  });
  result.commitmentsConsidered = commitmentRows.length;
  if (commitmentRows.length === 0) return result;

  const policyVersionIds = [...new Set(commitmentRows.map((c) => c.policyVersionId))];
  const calendarVersionIds = [...new Set(commitmentRows.map((c) => c.calendarVersionId))];
  const caseIds = [...new Set(commitmentRows.map((c) => c.caseId))];

  const [policyVersionRows, calendarVersionRows, eventRows, latestEvaluationRows] = await Promise.all([
    prisma.sLAPolicyVersion.findMany({ where: { id: { in: policyVersionIds } } }),
    prisma.businessCalendarVersion.findMany({ where: { id: { in: calendarVersionIds } } }),
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

  const evaluationsToCreate: Prisma.EvaluationCreateManyInput[] = [];
  const commitmentUpdates: { id: string; status: CommitmentStatus; closedAt: string | null }[] = [];

  for (const row of commitmentRows) {
    try {
      const policyVersion = policyVersionsById.get(row.policyVersionId);
      if (!policyVersion) throw new Error(`No SLAPolicyVersion loaded for ${row.policyVersionId}`);
      const calendarVersion = calendarsById.get(row.calendarVersionId);
      if (!calendarVersion) throw new Error(`No BusinessCalendarVersion loaded for ${row.calendarVersionId}`);

      const caseEvents = eventsByCaseId.get(row.caseId) ?? [];
      const commitment = toCommitmentDomain(row);
      const evaluation = evaluateCommitment(commitment, caseEvents, policyVersion, calendarVersion, asOf);

      const caseClosed = hasCaseClosedEvent(caseEvents, asOf);
      const terminal = isTerminalStatus(evaluation.status, caseClosed);

      if (
        shouldPersistEvaluation(
          evaluation.status,
          previousStatusByCommitmentId.get(row.id) ?? null,
          terminal,
          row.closedAt !== null,
        )
      ) {
        evaluationsToCreate.push({
          id: evaluation.id,
          commitmentId: evaluation.commitmentId,
          evaluatedAt: new Date(evaluation.evaluatedAt),
          elapsedWorkingMinutes: evaluation.elapsedWorkingMinutes,
          remainingMinutes: evaluation.remainingMinutes,
          status: evaluation.status,
          breachedByMinutes: evaluation.breachedByMinutes ?? null,
          inputs: evaluation.inputs as unknown as Prisma.InputJsonValue,
        });
      }

      if (evaluation.status !== row.status || (terminal && !row.closedAt)) {
        commitmentUpdates.push({
          id: row.id,
          status: evaluation.status,
          closedAt: terminal ? evaluation.evaluatedAt : null,
        });
        if (terminal && !row.closedAt) result.commitmentsFinalized += 1;
      }
    } catch (error) {
      result.commitmentsFailed.push({
        commitmentId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (evaluationsToCreate.length > 0) {
    const created = await prisma.evaluation.createMany({ data: evaluationsToCreate, skipDuplicates: true });
    result.evaluationsCreated = created.count;
  }

  for (const update of commitmentUpdates) {
    await prisma.commitment.update({
      where: { id: update.id },
      data: { status: update.status, ...(update.closedAt ? { closedAt: new Date(update.closedAt) } : {}) },
    });
  }

  return result;
}
