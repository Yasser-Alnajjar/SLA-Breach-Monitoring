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
        include: { calendarVersion: { select: { calendarId: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return policies
    .filter((policy) => policy.versions.length > 0)
    .map((policy) => {
      // The baseline for an imported policy is the latest version the
      // importer wrote, not the first: after a Zendesk-side change,
      // "Imported" should show Zendesk's current targets. Overrides sit on
      // top of it (`source: "override"`). A native policy has no imported
      // version at all, so its baseline is simply its first version.
      const baseline =
        policy.source === "imported"
          ? ([...policy.versions].reverse().find((version) => version.source === "imported") ??
            policy.versions[0]!)
          : policy.versions[0]!;
      const latest = policy.versions.at(-1)!;

      const importedTargets = normalizeTargets(baseline.targets);
      const targets = normalizeTargets(latest.targets);

      return {
        id: policy.id,
        name: policy.name,
        source: policy.source,
        active: policy.archivedAt === null && policy.deactivatedAt === null,
        version: latest.version,
        effectiveFrom: latest.effectiveFrom.toISOString(),
        createdAt: policy.createdAt.toISOString(),
        match: latest.match as SLAPolicyMatch,
        calendarId: latest.calendarVersion.calendarId,
        // 4i: whether `calendarId` above is the admin's own explicit pick, or
        // a resolved snapshot that stands in for "use the organization's
        // default calendar" — the UI needs this to pre-select the right
        // option, and to explain why a case's commitment used the calendar it
        // did.
        usesOrganizationDefaultCalendar: !latest.calendarIsExplicit,
        warnAtPercent: latest.warnAtPercent,
        targets,
        importedTargets,
        overridden: !targetsEqual(targets, importedTargets),
      };
    });
}
