import type { PrismaClient } from "@sla/db";
import type { CommitmentKind, SLAPolicyMatch } from "@sla/core";
import type {
  SlaPolicySummary,
  SlaPolicyTarget,
} from "./types/sla-configuration";

function normalizeTargets(targets: unknown): SlaPolicyTarget[] {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .filter(
      (target): target is { kind: CommitmentKind; minutes: number } =>
        typeof target === "object" &&
        target !== null &&
        "kind" in target &&
        "minutes" in target &&
        typeof target.kind === "string" &&
        typeof target.minutes === "number",
    )
    .map((target) => ({
      kind: target.kind,
      minutes: target.minutes,
    }));
}

function targetsEqual(a: SlaPolicyTarget[], b: SlaPolicyTarget[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const left = [...a].sort((x, y) => x.kind.localeCompare(y.kind));
  const right = [...b].sort((x, y) => x.kind.localeCompare(y.kind));

  return left.every(
    (target, index) =>
      target.kind === right[index]?.kind &&
      target.minutes === right[index]?.minutes,
  );
}

export async function getSlaPolicies(
  prisma: PrismaClient,
  organizationId: string,
): Promise<SlaPolicySummary[]> {
  const policies = await prisma.sLAPolicy.findMany({
    where: { organizationId },
    include: {
      versions: {
        orderBy: { version: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return policies
    .filter((policy) => policy.versions.length > 0)
    .map((policy) => {
      // The baseline is the latest version the importer wrote, not the first:
      // after a Zendesk-side change, "Imported" should show Zendesk's current
      // targets. Overrides sit on top of it (`source: "override"`).
      const imported =
        [...policy.versions].reverse().find((version) => version.source === "imported") ??
        policy.versions[0]!;
      const latest = policy.versions.at(-1)!;

      const importedTargets = normalizeTargets(imported.targets);
      const targets = normalizeTargets(latest.targets);

      return {
        id: policy.id,
        name: policy.name,
        imported: policy.externalId !== null,
        version: latest.version,
        effectiveFrom: latest.effectiveFrom.toISOString(),
        match: latest.match as SLAPolicyMatch,
        targets,
        importedTargets,
        overridden: !targetsEqual(targets, importedTargets),
      };
    });
}
