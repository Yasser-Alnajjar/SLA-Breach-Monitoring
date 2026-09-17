import type { Prisma, PrismaClient } from "@sla/db";
import {
  createCommitment,
  matchPolicyVersion,
  type BusinessCalendarVersion,
  type CaseAttributes,
  type CommitmentKind,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";

/** The single-cycle kinds this pipeline creates. Also `runNextReplyCyclePipeline`'s anchor kinds (cycle-pipeline.ts). */
export const COMMITMENT_KINDS: CommitmentKind[] = ["first_response", "resolution"];

export interface CaseRecord {
  id: string;
  priority: string | null;
  customerId: string | null;
  tier: string | null;
  openedAt: Date;
}

/** Builds packages/core's `CaseAttributes` from a persisted Case row. */
export function toCaseAttributes(caseRow: CaseRecord): CaseAttributes {
  return {
    caseId: caseRow.id,
    priority: caseRow.priority ?? undefined,
    customerId: caseRow.customerId ?? undefined,
    tier: caseRow.tier ?? undefined,
  };
}

export interface PolicyVersionRecord {
  id: string;
  policyId: string;
  version: number;
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
  pauseOnStates: NormalizedState[];
  calendarVersionId: string;
  warnAtPercent: number[];
  effectiveFrom: string;
}

/**
 * "Active" means the current version of each policy (Phase 13.6: editing
 * creates a new version; old versions are never destroyed, but they stop
 * being candidates for *new* commitments — existing commitments keep the
 * version id they were created under regardless).
 */
export function latestVersionPerPolicy(versions: PolicyVersionRecord[]): PolicyVersionRecord[] {
  const latestByPolicyId = new Map<string, PolicyVersionRecord>();
  for (const version of versions) {
    const current = latestByPolicyId.get(version.policyId);
    if (!current || version.version > current.version) latestByPolicyId.set(version.policyId, version);
  }
  return [...latestByPolicyId.values()];
}

/** Which of the two commitment kinds a Case doesn't have yet. */
export function missingCommitmentKinds(existingKinds: CommitmentKind[]): CommitmentKind[] {
  const existing = new Set(existingKinds);
  return COMMITMENT_KINDS.filter((kind) => !existing.has(kind));
}

/**
 * Which `BusinessCalendarVersion` a new commitment anchors to (roadmap step
 * 24): a customer-specific override, when the case's customer has one,
 * otherwise whatever the matched `SLAPolicyVersion` already specifies. Same
 * `Commitment.calendarVersionId` field and freeze-at-creation guarantee as
 * before — this only changes which version gets frozen in.
 */
export function resolveCommitmentCalendarVersion(
  policyCalendarVersion: BusinessCalendarVersion,
  customerCalendarVersion: BusinessCalendarVersion | undefined,
): BusinessCalendarVersion {
  return customerCalendarVersion ?? policyCalendarVersion;
}

/** Maps a persisted BusinessCalendarVersion row to packages/core's pure `BusinessCalendarVersion`. Shared with `runNextReplyCyclePipeline` (cycle-pipeline.ts). */
export function toCalendarVersionDomain(row: {
  id: string;
  version: number;
  timezone: string;
  weekly: unknown;
  holidays: string[];
  alwaysOpen: boolean;
}): BusinessCalendarVersion {
  return {
    id: row.id,
    version: row.version,
    timezone: row.timezone,
    weekly: row.weekly as WeeklyWindow[],
    holidays: row.holidays,
    alwaysOpen: row.alwaysOpen,
  };
}

export interface CommitmentPipelineResult {
  casesConsidered: number;
  commitmentsCreated: number;
  casesWithNoMatchingPolicy: number;
  casesFailed: { caseId: string; error: string }[];
}

/**
 * Creates first-response and resolution `Commitment`s for every Case in an
 * organization that doesn't have one yet, matching the Case's attributes
 * against the organization's active `SLAPolicyVersion`s (Phase 13.1). A
 * commitment, once created, is permanent — `@@unique([caseId, kind, cycleKey])`
 * with the single `SINGLE_CYCLE_KEY` enforces that a later policy edit or
 * re-run never creates a second one;
 * only an explicit future recalculation action (Phase 13.6) may replace it.
 * Safe to re-run: cases with both kinds already, or that match no policy,
 * are skipped without side effects.
 *
 * A case's commitments always share one policy and calendar version: a kind
 * still missing on a case that already has a commitment is created under
 * that commitment's frozen policy version and calendar version, never
 * re-matched against other policies. Only when that version has no target
 * for the kind (e.g. the policy gained a resolution target after the case's
 * first-response commitment was created) does it fall back to the newest
 * version of the *same* policy — still with the sibling's calendar.
 */
export async function runCommitmentPipeline(
  prisma: PrismaClient,
  organizationId: string,
): Promise<CommitmentPipelineResult> {
  const result: CommitmentPipelineResult = {
    casesConsidered: 0,
    commitmentsCreated: 0,
    casesWithNoMatchingPolicy: 0,
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

  const customersWithCalendarOverride = await prisma.customer.findMany({
    where: { organizationId, calendarId: { not: null } },
    select: { id: true, calendar: { select: { versions: { orderBy: { version: "desc" }, take: 1 } } } },
  });
  const customerCalendarVersionByCustomerId = new Map<string, BusinessCalendarVersion>();
  for (const customer of customersWithCalendarOverride) {
    const version = customer.calendar?.versions[0];
    if (!version) continue;
    customerCalendarVersionByCustomerId.set(customer.id, toCalendarVersionDomain(version));
  }

  const cases = await prisma.case.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      priority: true,
      customerId: true,
      tier: true,
      openedAt: true,
      // Scoped to the single-cycle kinds this pipeline creates: a persisted
      // Next Reply commitment must never be picked as the "sibling" below or
      // counted toward the calendar-version prefetch's completeness check.
      commitments: {
        where: { kind: { in: COMMITMENT_KINDS } },
        select: { kind: true, policyVersionId: true, calendarVersionId: true },
      },
    },
  });

  // Calendar versions frozen onto existing commitments that aren't already
  // loaded (e.g. a customer override that has since moved to a newer version).
  const missingCalendarVersionIds = [
    ...new Set(
      cases.flatMap((c) =>
        c.commitments.length < COMMITMENT_KINDS.length
          ? c.commitments.map((cm) => cm.calendarVersionId).filter((id) => !calendarsById.has(id))
          : [],
      ),
    ),
  ];
  if (missingCalendarVersionIds.length > 0) {
    const rows = await prisma.businessCalendarVersion.findMany({ where: { id: { in: missingCalendarVersionIds } } });
    for (const row of rows) calendarsById.set(row.id, toCalendarVersionDomain(row));
  }

  for (const caseRow of cases) {
    result.casesConsidered += 1;
    try {
      const missingKinds = missingCommitmentKinds(caseRow.commitments.map((c) => c.kind as CommitmentKind));
      if (missingKinds.length === 0) continue;

      const sibling = caseRow.commitments[0];
      let policyVersionFor: (kind: CommitmentKind) => SLAPolicyVersion;
      let calendarVersion: BusinessCalendarVersion;
      if (sibling) {
        const siblingPolicyVersion = policyVersionsById.get(sibling.policyVersionId);
        if (!siblingPolicyVersion) throw new Error(`No SLAPolicyVersion loaded for ${sibling.policyVersionId}`);
        const siblingCalendarVersion = calendarsById.get(sibling.calendarVersionId);
        if (!siblingCalendarVersion) throw new Error(`No BusinessCalendarVersion loaded for ${sibling.calendarVersionId}`);
        const latestOfSamePolicy =
          activePolicyVersions.find((pv) => pv.policyId === siblingPolicyVersion.policyId) ?? siblingPolicyVersion;
        policyVersionFor = (kind) =>
          siblingPolicyVersion.targets.some((t) => t.kind === kind) ? siblingPolicyVersion : latestOfSamePolicy;
        calendarVersion = siblingCalendarVersion;
      } else {
        const matched = matchPolicyVersion(toCaseAttributes(caseRow), activePolicyVersions);
        if (!matched) {
          result.casesWithNoMatchingPolicy += 1;
          continue;
        }
        const policyCalendarVersion = calendarsById.get(matched.calendarVersionId);
        if (!policyCalendarVersion) throw new Error(`No BusinessCalendarVersion loaded for ${matched.calendarVersionId}`);
        policyVersionFor = () => matched;
        calendarVersion = resolveCommitmentCalendarVersion(
          policyCalendarVersion,
          caseRow.customerId ? customerCalendarVersionByCustomerId.get(caseRow.customerId) : undefined,
        );
      }

      for (const kind of missingKinds) {
        const policyVersion = policyVersionFor(kind);
        if (!policyVersion.targets.some((t) => t.kind === kind)) continue;

        const commitment = createCommitment(
          caseRow.id,
          kind,
          caseRow.openedAt.toISOString(),
          policyVersion,
          calendarVersion,
        );
        await prisma.commitment.create({
          data: {
            id: commitment.id,
            caseId: commitment.caseId,
            kind: commitment.kind,
            policyVersionId: commitment.policyVersionId,
            calendarVersionId: commitment.calendarVersionId,
            startedAt: new Date(commitment.startedAt),
            targetMinutes: commitment.targetMinutes,
            dueAt: new Date(commitment.dueAt),
            status: commitment.status,
          } satisfies Prisma.CommitmentCreateManyInput,
        });
        result.commitmentsCreated += 1;
      }
    } catch (error) {
      result.casesFailed.push({ caseId: caseRow.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
