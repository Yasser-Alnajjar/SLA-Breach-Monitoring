import type { PrismaClient } from "@sla/db";
import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";
import type { SlaPolicySummary } from "./types/sla-configuration";

/** SLA policies with their current (latest) version, for the settings override UI (roadmap step 19). */
export async function getSlaPolicies(prisma: PrismaClient, organizationId: string): Promise<SlaPolicySummary[]> {
  const policies = await prisma.sLAPolicy.findMany({
    where: { organizationId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return policies
    .filter((policy) => policy.versions[0])
    .map((policy) => {
      const latest = policy.versions[0]!;
      return {
        id: policy.id,
        name: policy.name,
        imported: policy.externalId !== null,
        version: latest.version,
        effectiveFrom: latest.effectiveFrom.toISOString(),
        match: latest.match as SLAPolicyMatch,
        targets: latest.targets as { kind: CommitmentKind; minutes: number }[],
      };
    });
}
