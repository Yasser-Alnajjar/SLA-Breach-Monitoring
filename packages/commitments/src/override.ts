import type { Prisma, PrismaClient } from "@sla/db";
import { policyVersionContentEquals, type CommitmentKind, type SLAPolicyMatch } from "@sla/core";

export class PolicyNotFoundError extends Error {
  constructor(policyId: string) {
    super(`SLA policy ${policyId} not found`);
  }
}

export interface PolicyOverrideResult {
  /** False when the submitted targets matched the current version exactly — no new version was written. */
  created: boolean;
  version: { id: string; version: number };
}

/**
 * Manual override of a matched policy's targets (roadmap step 19). Appends a
 * new `SLAPolicyVersion` through the same versioning path the Zendesk
 * importer uses (step 6) rather than a side channel: `match`, `pauseOnStates`,
 * `calendarVersionId`, and `warnAtPercent` are carried over unchanged from the
 * current latest version, only `targets` changes, and `policyVersionContentEquals`
 * keeps a no-op submission from creating a redundant version. Existing
 * commitments keep pointing at whatever version they were created under
 * (`Commitment.policyVersionId` is frozen at creation) — only future
 * commitments pick up the override. Written as `source: "override"` so the
 * Zendesk importer, which compares only against imported versions, leaves
 * it in place until the policy actually changes in Zendesk.
 */
export async function overridePolicyTargets(
  prisma: PrismaClient,
  organizationId: string,
  policyId: string,
  targets: { kind: CommitmentKind; minutes: number }[],
): Promise<PolicyOverrideResult> {
  const policy = await prisma.sLAPolicy.findFirst({ where: { id: policyId, organizationId } });
  if (!policy) throw new PolicyNotFoundError(policyId);

  const latestVersion = await prisma.sLAPolicyVersion.findFirst({
    where: { policyId },
    orderBy: { version: "desc" },
  });
  if (!latestVersion) throw new PolicyNotFoundError(policyId);

  const match = latestVersion.match as SLAPolicyMatch;
  const unchanged = policyVersionContentEquals(
    {
      match,
      targets: latestVersion.targets as { kind: CommitmentKind; minutes: number }[],
      calendarVersionId: latestVersion.calendarVersionId,
    },
    { match, targets, calendarVersionId: latestVersion.calendarVersionId },
  );
  if (unchanged) {
    return { created: false, version: { id: latestVersion.id, version: latestVersion.version } };
  }

  const created = await prisma.sLAPolicyVersion.create({
    data: {
      policyId,
      version: latestVersion.version + 1,
      match: latestVersion.match as Prisma.InputJsonValue,
      targets: targets as unknown as Prisma.InputJsonValue,
      pauseOnStates: latestVersion.pauseOnStates,
      calendarVersionId: latestVersion.calendarVersionId,
      warnAtPercent: latestVersion.warnAtPercent,
      effectiveFrom: new Date(),
      source: "override",
    },
  });

  return { created: true, version: { id: created.id, version: created.version } };
}
