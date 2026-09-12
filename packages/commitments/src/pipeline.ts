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

const COMMITMENT_KINDS: CommitmentKind[] = ["first_response", "resolution"];

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
 * commitment, once created, is permanent — `@@unique([caseId, kind])`
 * enforces that a later policy edit or re-run never creates a second one;
 * only an explicit future recalculation action (Phase 13.6) may replace it.
 * Safe to re-run: cases with both kinds already, or that match no policy,
 * are skipped without side effects.
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

  const activePolicyVersions: SLAPolicyVersion[] = latestVersionPerPolicy(
    policyVersionRows.map((row) => ({
      id: row.id,
      policyId: row.policyId,
      version: row.version,
      match: row.match as SLAPolicyMatch,
      targets: row.targets as { kind: CommitmentKind; minutes: number }[],
      pauseOnStates: row.pauseOnStates as NormalizedState[],
      calendarVersionId: row.calendarVersionId,
      warnAtPercent: row.warnAtPercent,
      effectiveFrom: row.effectiveFrom.toISOString(),
    })),
  );

  const calendarsById = new Map<string, BusinessCalendarVersion>(
    policyVersionRows.map((row) => [
      row.calendarVersion.id,
      {
        id: row.calendarVersion.id,
        version: row.calendarVersion.version,
        timezone: row.calendarVersion.timezone,
        weekly: row.calendarVersion.weekly as unknown as WeeklyWindow[],
        holidays: row.calendarVersion.holidays,
        alwaysOpen: row.calendarVersion.alwaysOpen,
      },
    ]),
  );

  const cases = await prisma.case.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      priority: true,
      customerId: true,
      tier: true,
      openedAt: true,
      commitments: { select: { kind: true } },
    },
  });

  for (const caseRow of cases) {
    result.casesConsidered += 1;
    try {
      const missingKinds = missingCommitmentKinds(caseRow.commitments.map((c) => c.kind as CommitmentKind));
      if (missingKinds.length === 0) continue;

      const policyVersion = matchPolicyVersion(toCaseAttributes(caseRow), activePolicyVersions);
      if (!policyVersion) {
        result.casesWithNoMatchingPolicy += 1;
        continue;
      }
      const calendarVersion = calendarsById.get(policyVersion.calendarVersionId);
      if (!calendarVersion) throw new Error(`No BusinessCalendarVersion loaded for ${policyVersion.calendarVersionId}`);

      for (const kind of missingKinds) {
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
