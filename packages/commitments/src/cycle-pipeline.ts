import type { PrismaClient } from "@sla/db";
import {
  deriveNextReplyCycles,
  findFirstResponseEvent,
  type BusinessCalendarVersion,
  type CommitmentKind,
  type NormalizedEvent,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
} from "@sla/core";
import { persistNextReplyCommitments } from "./cycle-commitments";
import { toNormalizedEventDomain } from "./evaluate-pipeline";
import { COMMITMENT_KINDS, latestVersionPerPolicy, toCalendarVersionDomain } from "./pipeline";

export interface NextReplyCyclePipelineResult {
  casesConsidered: number;
  cyclesCreated: number;
  cyclesCancelled: number;
  cyclesRestored: number;
  casesFailed: { caseId: string; error: string }[];
}

/**
 * Makes every case's persisted Next Reply commitments match its derived
 * cycles (`persistNextReplyCommitments`), across every case in an
 * organization. Runs after `runCommitmentPipeline` and before
 * `runEvaluationPipeline` in every orchestration path (worker cycle, webhook
 * tail, source-sync): it needs a case's frozen first-response or resolution
 * commitment as its policy/calendar anchor, the same "a case's commitments
 * always share one policy and calendar version" rule `runCommitmentPipeline`
 * already follows for its own sibling kinds (pipeline.ts) — this is
 * deliberately not a second, independent policy-resolution mechanism.
 *
 * A case with no such anchor commitment yet (no matching policy) is skipped:
 * there's nothing to anchor a Next Reply cycle to, and `runCommitmentPipeline`
 * already reports that case's unmatched-policy state.
 *
 * A case whose anchor policy version has no `next_reply` target still runs
 * through `persistNextReplyCommitments` with `cycles: []` — not skipped —
 * so a previously-live cycle gets cancelled by the same planner that cancels
 * any other vanished cycle (`planCycleCommitments`): losing the target isn't
 * different from losing every cycle.
 *
 * Never evaluates a cycle's commitment. `runEvaluationPipeline` excludes
 * `next_reply` from its scope until Next Reply evaluation is implemented
 * (evaluate-pipeline.ts).
 */
export async function runNextReplyCyclePipeline(
  prisma: PrismaClient,
  organizationId: string,
  options: { asOf?: string } = {},
): Promise<NextReplyCyclePipelineResult> {
  const asOf = options.asOf ?? new Date().toISOString();

  const result: NextReplyCyclePipelineResult = {
    casesConsidered: 0,
    cyclesCreated: 0,
    cyclesCancelled: 0,
    cyclesRestored: 0,
    casesFailed: [],
  };

  const policyVersionRows = await prisma.sLAPolicyVersion.findMany({
    where: { policy: { organizationId } },
    include: { calendarVersion: true },
  });
  if (policyVersionRows.length === 0) return result;

  const allPolicyVersions: SLAPolicyVersion[] = policyVersionRows.map((row) => ({
    id: row.id,
    policyId: row.policyId,
    version: row.version,
    match: row.match as SLAPolicyMatch,
    targets: row.targets as { kind: CommitmentKind; minutes: number }[],
    pauseOnStates: row.pauseOnStates as NormalizedState[],
    calendarVersionId: row.calendarVersionId,
    warnAtPercent: row.warnAtPercent,
    effectiveFrom: row.effectiveFrom.toISOString(),
  }));
  const policyVersionsById = new Map(allPolicyVersions.map((pv) => [pv.id, pv]));
  const activePolicyVersions = latestVersionPerPolicy(allPolicyVersions);

  const calendarsById = new Map<string, BusinessCalendarVersion>(
    policyVersionRows.map((row) => [row.calendarVersion.id, toCalendarVersionDomain(row.calendarVersion)]),
  );

  const cases = await prisma.case.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      // The same anchor kinds runCommitmentPipeline creates; a persisted
      // Next Reply commitment is never its own anchor.
      commitments: {
        where: { kind: { in: COMMITMENT_KINDS } },
        select: { kind: true, policyVersionId: true, calendarVersionId: true },
      },
    },
  });

  // Calendar versions frozen onto an anchor commitment that aren't already
  // loaded (e.g. a customer override that has since moved to a newer version).
  const missingCalendarVersionIds = [
    ...new Set(
      cases.flatMap((c) => c.commitments.map((cm) => cm.calendarVersionId).filter((id) => !calendarsById.has(id))),
    ),
  ];
  if (missingCalendarVersionIds.length > 0) {
    const rows = await prisma.businessCalendarVersion.findMany({ where: { id: { in: missingCalendarVersionIds } } });
    for (const row of rows) calendarsById.set(row.id, toCalendarVersionDomain(row));
  }

  // Only cases with an anchor need their events loaded — a case with no
  // matched policy yet is skipped below without ever touching NormalizedEvent.
  const anchoredCaseIds = cases.filter((c) => c.commitments.length > 0).map((c) => c.id);
  const eventRows =
    anchoredCaseIds.length > 0
      ? await prisma.normalizedEvent.findMany({
          where: { caseId: { in: anchoredCaseIds } },
          orderBy: [{ caseId: "asc" }, { occurredAt: "asc" }, { sourceSequence: "asc" }],
        })
      : [];
  const eventsByCaseId = new Map<string, NormalizedEvent[]>();
  for (const row of eventRows) {
    const domainEvent = toNormalizedEventDomain(row);
    const existing = eventsByCaseId.get(row.caseId);
    if (existing) existing.push(domainEvent);
    else eventsByCaseId.set(row.caseId, [domainEvent]);
  }

  for (const caseRow of cases) {
    result.casesConsidered += 1;
    try {
      const anchor = caseRow.commitments[0];
      if (!anchor) continue;

      const anchorPolicyVersion = policyVersionsById.get(anchor.policyVersionId);
      if (!anchorPolicyVersion) throw new Error(`No SLAPolicyVersion loaded for ${anchor.policyVersionId}`);
      const anchorCalendarVersion = calendarsById.get(anchor.calendarVersionId);
      if (!anchorCalendarVersion) throw new Error(`No BusinessCalendarVersion loaded for ${anchor.calendarVersionId}`);

      // Same fallback pipeline.ts uses for a missing sibling kind: prefer the
      // anchor's own frozen policy version if it already targets next_reply,
      // otherwise the newest version of that same policy — still with the
      // anchor's calendar.
      const latestOfSamePolicy =
        activePolicyVersions.find((pv) => pv.policyId === anchorPolicyVersion.policyId) ?? anchorPolicyVersion;
      const policyVersion = anchorPolicyVersion.targets.some((t) => t.kind === "next_reply")
        ? anchorPolicyVersion
        : latestOfSamePolicy;
      const calendarVersion = anchorCalendarVersion;

      const events = eventsByCaseId.get(caseRow.id) ?? [];
      const cycles = policyVersion.targets.some((t) => t.kind === "next_reply")
        ? deriveNextReplyCycles(events, { asOf, firstResponseCompletion: findFirstResponseEvent(events, asOf) })
        : [];

      const { created, cancelled, restored } = await persistNextReplyCommitments(prisma, {
        caseId: caseRow.id,
        cycles,
        policyVersion,
        calendarVersion,
        asOf,
      });
      result.cyclesCreated += created;
      result.cyclesCancelled += cancelled;
      result.cyclesRestored += restored;
    } catch (error) {
      result.casesFailed.push({ caseId: caseRow.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
