import type { CommitmentKind, SLAPolicyMatch } from "./types";

export interface PolicyVersionContent {
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
  calendarVersionId: string;
}

function normalizeMatch(match: SLAPolicyMatch): SLAPolicyMatch {
  return {
    priority: match.priority ? [...match.priority].sort() : undefined,
    customerIds: match.customerIds ? [...match.customerIds].sort() : undefined,
    tier: match.tier ? [...match.tier].sort() : undefined,
  };
}

function normalizeTargets(targets: { kind: CommitmentKind; minutes: number }[]) {
  return [...targets].sort((a, b) => a.kind.localeCompare(b.kind));
}

/**
 * Whether a newly-derived policy version would be identical to the current
 * one, so writing one never creates a no-op version. Shared by the Zendesk
 * importer (roadmap step 6) and the manual override path (step 19) — both
 * append to the same `SLAPolicyVersion` history and must agree on what
 * counts as "unchanged."
 */
export function policyVersionContentEquals(existing: PolicyVersionContent, desired: PolicyVersionContent): boolean {
  if (existing.calendarVersionId !== desired.calendarVersionId) return false;
  return (
    JSON.stringify(normalizeMatch(existing.match)) === JSON.stringify(normalizeMatch(desired.match)) &&
    JSON.stringify(normalizeTargets(existing.targets)) === JSON.stringify(normalizeTargets(desired.targets))
  );
}
