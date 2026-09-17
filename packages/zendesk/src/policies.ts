import type { Prisma, PrismaClient } from "@sla/db";
import { policyVersionContentEquals, type CommitmentKind, type NormalizedState, type SLAPolicyMatch } from "@sla/core";
import { latestCalendarVersionsByZendeskScheduleId } from "./calendars";
import { latestSnapshotById } from "./normalize";
import type { ZendeskSlaPolicy, ZendeskSlaPolicyCondition, ZendeskSlaPolicyFilter, ZendeskSlaPolicyMetric } from "./types";

/**
 * Zendesk SLA metric name -> the CommitmentKind packages/core knows how to
 * track. Zendesk's API names the resolution metric `total_resolution_time`
 * (admin center: "Total resolution time"); `resolution_time` is kept for
 * snapshots that use the shorter name. Every other Zendesk metric
 * (next_reply_time, requester_wait_time, agent_work_time,
 * periodic_update_time, pausable_update_time) has no equivalent and is
 * dropped.
 */
const METRIC_TO_COMMITMENT_KIND: Record<string, CommitmentKind> = {
  first_reply_time: "first_response",
  total_resolution_time: "resolution",
  resolution_time: "resolution",
};

/** Condition fields the importer can express in `SLAPolicyMatch`. Anything else (group_id, tags, form_id, ...) is dropped — Phase 10 explicitly defers a configurable rules engine. */
const SUPPORTED_CONDITION_FIELDS = new Set(["priority", "organization_id"]);

/** Customer-caused waiting, regardless of which system reports it (Phase 13.4) — fixed for every imported policy, not configurable in v1. Only commitment kinds whose clock rules honor the policy's pause states pause on it (`pauseStatesFor` in @sla/core): resolution does, first response never pauses. */
export const PAUSE_ON_STATES: NormalizedState[] = ["pending_customer"];
export const WARN_AT_PERCENT = [50, 80, 95];
export const DEFAULT_CALENDAR_NAME = "Default (always open)";

export interface ExtractedMatch {
  match: SLAPolicyMatch;
  /** Conditions present in the filter that couldn't be represented — reported so import coverage is honest, never silently dropped. */
  unsupportedConditions: number;
}

function conditionValues(conditions: ZendeskSlaPolicyCondition[], field: string): string[] {
  return conditions.filter((c) => c.field === field && c.value != null).map((c) => String(c.value).toLowerCase());
}

/**
 * Flattens a Zendesk SLA policy's `filter` into packages/core's
 * `SLAPolicyMatch`. `all` and `any` conditions on the same field are folded
 * into one OR-set for that field — exact for the common case (a single
 * "priority is X" or "priority is X OR Y" condition), but a filter that ORs
 * across *different* fields cannot be represented by our AND-across-
 * dimensions match model and will end up matching more broadly than
 * Zendesk's own evaluation. Organization conditions are translated to our
 * internal Customer ids via the Zendesk org id already recorded on Customer
 * (roadmap step 3) — an org with no Customer yet (never seen on a ticket)
 * cannot be matched and is silently excluded from `customerIds`, not
 * treated as an error.
 */
export function extractMatchFromFilter(
  filter: ZendeskSlaPolicyFilter | undefined,
  customerIdsByZendeskOrgId: ReadonlyMap<string, string>,
): ExtractedMatch {
  const conditions = [...(filter?.all ?? []), ...(filter?.any ?? [])];
  const unsupportedConditions = conditions.filter((c) => !SUPPORTED_CONDITION_FIELDS.has(c.field)).length;

  const priorities = new Set(conditionValues(conditions, "priority"));
  const customerIds = new Set(
    conditionValues(conditions, "organization_id")
      .map((zendeskOrgId) => customerIdsByZendeskOrgId.get(zendeskOrgId))
      .filter((id): id is string => id != null),
  );

  const match: SLAPolicyMatch = {};
  if (priorities.size > 0) match.priority = [...priorities];
  if (customerIds.size > 0) match.customerIds = [...customerIds];

  return { match, unsupportedConditions };
}

export interface PolicyTargetGroup {
  /** Ticket priority this group of targets applies to, or null when it applies regardless of priority. */
  priority: string | null;
  targets: { kind: CommitmentKind; minutes: number }[];
}

export interface GroupedPolicyMetrics {
  groups: PolicyTargetGroup[];
  /** Metrics whose Zendesk name has no CommitmentKind equivalent — reported, not silently dropped. */
  unsupportedMetrics: number;
}

/**
 * Groups a Zendesk SLA policy's `policy_metrics` by the priority tier they
 * apply to. Each group becomes a separate `SLAPolicy` identity in our
 * schema (see `runZendeskSlaPolicyImport`), since one `SLAPolicyVersion`
 * carries a single `targets` array and Zendesk lets one policy define
 * different first-reply/resolution targets per priority.
 */
export function groupPolicyMetricsByPriority(metrics: ZendeskSlaPolicyMetric[] | undefined): GroupedPolicyMetrics {
  const byPriority = new Map<string | null, { kind: CommitmentKind; minutes: number }[]>();
  let unsupportedMetrics = 0;

  for (const metric of metrics ?? []) {
    const kind = METRIC_TO_COMMITMENT_KIND[metric.metric];
    if (!kind) {
      unsupportedMetrics += 1;
      continue;
    }
    const priority = metric.priority ? metric.priority.toLowerCase() : null;
    const targets = byPriority.get(priority) ?? [];
    targets.push({ kind, minutes: metric.target });
    byPriority.set(priority, targets);
  }

  const groups = [...byPriority.entries()].map(([priority, targets]) => ({ priority, targets }));
  return { groups, unsupportedMetrics };
}

interface PolicyVersionContent {
  match: SLAPolicyMatch;
  targets: { kind: CommitmentKind; minutes: number }[];
  calendarVersionId: string;
}

export { policyVersionContentEquals };

/**
 * Ensures the organization has a business calendar to anchor commitments to.
 * Zendesk's actual business-hours schedules aren't ingested by this pass
 * (Phase 13.5 notes they SHOULD be imported from Zendesk — deferred past
 * this step); every imported SLA policy is anchored to one always-open
 * calendar per organization instead, which computes deadlines honestly as
 * "24/7" rather than guessing at hours we don't have.
 */
export async function ensureDefaultCalendarVersion(
  prisma: PrismaClient,
  organizationId: string,
): Promise<{ id: string }> {
  const existing = await prisma.businessCalendar.findFirst({
    where: { organizationId, name: DEFAULT_CALENDAR_NAME },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (existing?.versions[0]) return existing.versions[0];

  const created = await prisma.businessCalendar.create({
    data: {
      organizationId,
      name: DEFAULT_CALENDAR_NAME,
      versions: { create: { version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: true } },
    },
    include: { versions: true },
  });
  return created.versions[0]!;
}

/**
 * Which `BusinessCalendarVersion` a policy's commitments should anchor to.
 * A policy with `schedule_id` set points at a specific Zendesk business
 * hours schedule; if that schedule has been imported (roadmap step 13) its
 * calendar is used, otherwise the policy falls back to the always-open
 * default and the gap is counted, never guessed at. A policy with no
 * `schedule_id` (calendar-time metrics, or an account with no selectable
 * schedule) also uses the default.
 */
export function resolvePolicyCalendarVersion(
  policy: ZendeskSlaPolicy,
  calendarVersionsByScheduleId: ReadonlyMap<number, { id: string }>,
  defaultCalendarVersion: { id: string },
): { calendarVersionId: string; scheduleUnresolved: boolean } {
  if (policy.schedule_id == null) {
    return { calendarVersionId: defaultCalendarVersion.id, scheduleUnresolved: false };
  }
  const resolved = calendarVersionsByScheduleId.get(policy.schedule_id);
  if (resolved) {
    return { calendarVersionId: resolved.id, scheduleUnresolved: false };
  }
  return { calendarVersionId: defaultCalendarVersion.id, scheduleUnresolved: true };
}

/**
 * Appends an `imported` version when Zendesk's policy content differs from
 * the last one we imported. Compares against the latest *imported* version,
 * not the latest version: a manual override (`source: "override"`, roadmap
 * step 19) sits on top of an imported version, and comparing Zendesk's
 * unchanged targets against the override would revert it on the next sync.
 * A real change on the Zendesk side still creates a new imported version,
 * which supersedes any override made against the old one.
 */
export async function upsertPolicyVersion(
  prisma: PrismaClient,
  organizationId: string,
  externalId: string,
  name: string,
  desired: PolicyVersionContent,
): Promise<boolean> {
  const policy = await prisma.sLAPolicy.upsert({
    where: { organizationId_externalId: { organizationId, externalId } },
    update: { name },
    create: { organizationId, externalId, name },
  });

  const [latestVersion, latestImportedVersion] = await Promise.all([
    prisma.sLAPolicyVersion.findFirst({
      where: { policyId: policy.id },
      orderBy: { version: "desc" },
    }),
    prisma.sLAPolicyVersion.findFirst({
      where: { policyId: policy.id, source: "imported" },
      orderBy: { version: "desc" },
    }),
  ]);

  if (
    latestImportedVersion &&
    policyVersionContentEquals(
      {
        match: latestImportedVersion.match as SLAPolicyMatch,
        targets: latestImportedVersion.targets as { kind: CommitmentKind; minutes: number }[],
        calendarVersionId: latestImportedVersion.calendarVersionId,
      },
      desired,
    )
  ) {
    return false;
  }

  await prisma.sLAPolicyVersion.create({
    data: {
      policyId: policy.id,
      version: (latestVersion?.version ?? 0) + 1,
      match: desired.match as unknown as Prisma.InputJsonValue,
      targets: desired.targets as unknown as Prisma.InputJsonValue,
      pauseOnStates: PAUSE_ON_STATES,
      calendarVersionId: desired.calendarVersionId,
      warnAtPercent: WARN_AT_PERCENT,
      effectiveFrom: new Date(),
      source: "imported",
    },
  });
  return true;
}

export interface SlaPolicyImportResult {
  policiesEvaluated: number;
  policyVersionsCreated: number;
  unsupportedConditions: number;
  unsupportedMetrics: number;
  policiesWithNoUsableTargets: number;
  /** Policies whose `schedule_id` points at a schedule not (yet) imported as a BusinessCalendar — fell back to the always-open default. */
  policiesWithUnresolvedSchedule: number;
}

/**
 * `RawEvent` (sla_policy snapshots) -> `SLAPolicy`/`SLAPolicyVersion`
 * (Phase 10: "imported from Zendesk first, editable second"). Idempotent:
 * re-running only creates a new version when a policy's match or targets
 * actually changed since the last import, so a manual override survives
 * until then. No fuzzy matching — a filter condition or metric this
 * importer doesn't understand is dropped and counted, never guessed at.
 */
export async function runZendeskSlaPolicyImport(
  prisma: PrismaClient,
  integrationId: string,
): Promise<SlaPolicyImportResult> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const organizationId = integration.organizationId;

  const result: SlaPolicyImportResult = {
    policiesEvaluated: 0,
    policyVersionsCreated: 0,
    unsupportedConditions: 0,
    unsupportedMetrics: 0,
    policiesWithNoUsableTargets: 0,
    policiesWithUnresolvedSchedule: 0,
  };

  const rows = await prisma.rawEvent.findMany({
    where: { integrationId, providerEventId: { startsWith: "sla_policy:" } },
    select: { id: true, payload: true, fetchedAt: true },
    orderBy: { fetchedAt: "asc" },
  });
  const latestPolicies = latestSnapshotById<ZendeskSlaPolicy>(rows);
  if (latestPolicies.size === 0) return result;

  const customers = await prisma.customer.findMany({
    where: { organizationId, zendeskOrgId: { not: null } },
    select: { id: true, zendeskOrgId: true },
  });
  const customerIdsByZendeskOrgId = new Map(customers.map((c) => [c.zendeskOrgId as string, c.id]));

  const defaultCalendarVersion = await ensureDefaultCalendarVersion(prisma, organizationId);
  const calendarVersionsByScheduleId = await latestCalendarVersionsByZendeskScheduleId(prisma, organizationId);

  for (const { value: policy } of latestPolicies.values()) {
    result.policiesEvaluated += 1;

    const { match: filterMatch, unsupportedConditions } = extractMatchFromFilter(
      policy.filter,
      customerIdsByZendeskOrgId,
    );
    result.unsupportedConditions += unsupportedConditions;

    const { groups, unsupportedMetrics } = groupPolicyMetricsByPriority(policy.policy_metrics);
    result.unsupportedMetrics += unsupportedMetrics;

    if (groups.length === 0) {
      result.policiesWithNoUsableTargets += 1;
      continue;
    }

    const { calendarVersionId, scheduleUnresolved } = resolvePolicyCalendarVersion(
      policy,
      calendarVersionsByScheduleId,
      defaultCalendarVersion,
    );
    if (scheduleUnresolved) result.policiesWithUnresolvedSchedule += 1;

    for (const group of groups) {
      const externalId = `${policy.id}:${group.priority ?? "any"}`;
      const match: SLAPolicyMatch = { ...filterMatch };
      if (group.priority) match.priority = [group.priority];

      const created = await upsertPolicyVersion(prisma, organizationId, externalId, policy.title, {
        match,
        targets: group.targets,
        calendarVersionId,
      });
      if (created) result.policyVersionsCreated += 1;
    }
  }

  return result;
}
