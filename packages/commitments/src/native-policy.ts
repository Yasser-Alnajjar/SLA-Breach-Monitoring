import type { Prisma, PrismaClient } from "@sla/db";
import {
  policyVersionContentEquals,
  type CommitmentKind,
  type SLAPolicyMatch,
} from "@sla/core";
import { PolicyNotFoundError } from "./override";
import { CalendarNotFoundError } from "./customer-calendar";
import { resolveOrganizationCalendarFallback } from "./calendar-fallback";

export class CustomerIdsNotFoundError extends Error {
  constructor(customerIds: string[]) {
    super(`Customer id(s) not found in this organization: ${customerIds.join(", ")}`);
  }
}

/** Not usable on an imported policy — that path is `overridePolicyTargets` (target-only). */
export class NotANativePolicyError extends Error {
  constructor(policyId: string) {
    super(`SLA policy ${policyId} is not a native policy`);
  }
}

export interface NativePolicyMatchInput {
  priority?: string[];
  customerIds?: string[];
}

export interface NativePolicyFields {
  match: NativePolicyMatchInput;
  targets: { kind: CommitmentKind; minutes: number }[];
  /**
   * The calendar the user explicitly chose, or omitted for "use the
   * organization's default calendar" (4i) — every new commitment then
   * resolves that fresh, at creation time, rather than freezing a snapshot
   * here. See `resolveEffectiveCalendarVersion`, calendar-fallback.ts.
   */
  calendarId?: string;
  warnAtPercent: number[];
}

export interface NativePolicyVersionResult {
  policyId: string;
  version: { id: string; version: number };
}

/** Same fixed pause-on-states every imported policy gets (Phase 1) — not configurable in v1 for native policies either. */
const PAUSE_ON_STATES = ["pending_customer"] as const;

async function resolveCalendarVersionId(
  prisma: PrismaClient,
  organizationId: string,
  calendarId: string,
): Promise<string> {
  const calendar = await prisma.businessCalendar.findFirst({
    where: { id: calendarId, organizationId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!calendar?.versions[0]) throw new CalendarNotFoundError(calendarId);
  return calendar.versions[0].id;
}

/**
 * The `calendarVersionId` a policy version with no explicit calendar gets at
 * save time (4i) — purely a usable snapshot for display/backward
 * compatibility; commitment creation never trusts it directly for such a
 * version (see `calendarIsExplicit`), always re-resolving fresh instead.
 */
async function resolveFallbackCalendarVersionId(
  prisma: PrismaClient,
  organizationId: string,
): Promise<string> {
  const fallback = await resolveOrganizationCalendarFallback(prisma, organizationId);
  const version = fallback.organizationDefault ?? (await fallback.getAlwaysOpen());
  return version.id;
}

async function validateCustomerIds(
  prisma: PrismaClient,
  organizationId: string,
  customerIds: string[] | undefined,
): Promise<void> {
  if (!customerIds || customerIds.length === 0) return;
  const found = await prisma.customer.findMany({
    where: { id: { in: customerIds }, organizationId },
    select: { id: true },
  });
  const foundIds = new Set(found.map((c) => c.id));
  const missing = customerIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) throw new CustomerIdsNotFoundError(missing);
}

/**
 * Creates a native SLA policy (task 4.3, D12) — the org-created counterpart
 * to a Zendesk-imported one. No rules engine: `match` only exposes the
 * legacy `priority`/`customerIds` fields the UI shows, not the generic
 * `conditions.all`/`any` builder imported policies can carry. Goes through
 * the exact same `SLAPolicyVersion` table and `matchPolicyVersion` engine as
 * an imported policy — the only difference is `source: "native"`, which
 * `matchPolicyVersion` (D12) ranks behind every imported policy.
 */
export async function createNativePolicy(
  prisma: PrismaClient,
  organizationId: string,
  name: string,
  fields: NativePolicyFields,
): Promise<NativePolicyVersionResult> {
  await validateCustomerIds(prisma, organizationId, fields.match.customerIds);
  const calendarVersionId = fields.calendarId
    ? await resolveCalendarVersionId(prisma, organizationId, fields.calendarId)
    : await resolveFallbackCalendarVersionId(prisma, organizationId);

  const policy = await prisma.sLAPolicy.create({
    data: { organizationId, name, source: "native" },
  });
  const version = await prisma.sLAPolicyVersion.create({
    data: {
      policyId: policy.id,
      version: 1,
      match: fields.match as unknown as Prisma.InputJsonValue,
      targets: fields.targets as unknown as Prisma.InputJsonValue,
      pauseOnStates: [...PAUSE_ON_STATES],
      calendarVersionId,
      calendarIsExplicit: fields.calendarId !== undefined,
      warnAtPercent: fields.warnAtPercent,
      effectiveFrom: new Date(),
      source: "native",
    },
  });

  return {
    policyId: policy.id,
    version: { id: version.id, version: version.version },
  };
}

export interface UpdateNativePolicyInput {
  name?: string;
  match?: NativePolicyMatchInput;
  targets?: { kind: CommitmentKind; minutes: number }[];
  /** Omitted: leave the calendar untouched (explicit or absent, exactly as it was). A string: explicitly pin this calendar, resolved fresh to its current latest version. `null`: explicitly clear to "use the organization's default calendar" (4i). */
  calendarId?: string | null;
  warnAtPercent?: number[];
}

/**
 * Edits a native policy (task 4.4, D1). Every edit appends a new
 * `SLAPolicyVersion` — per D1, this never touches an already-active
 * commitment (`Commitment.policyVersionId` is frozen at creation); only a
 * later case whose matching re-runs picks up the new version. Fields not
 * given are carried over unchanged from the latest version, mirroring
 * `overridePolicyTargets`. A submission identical to the latest version is a
 * no-op (`created: false`), same short-circuit as an imported override.
 */
export async function updateNativePolicy(
  prisma: PrismaClient,
  organizationId: string,
  policyId: string,
  input: UpdateNativePolicyInput,
): Promise<NativePolicyVersionResult & { created: boolean }> {
  const policy = await prisma.sLAPolicy.findFirst({
    where: { id: policyId, organizationId },
  });
  if (!policy) throw new PolicyNotFoundError(policyId);
  if (policy.source !== "native") throw new NotANativePolicyError(policyId);

  const latestVersion = await prisma.sLAPolicyVersion.findFirst({
    where: { policyId },
    orderBy: { version: "desc" },
  });
  if (!latestVersion) throw new PolicyNotFoundError(policyId);

  if (input.match?.customerIds) {
    await validateCustomerIds(prisma, organizationId, input.match.customerIds);
  }
  // 4i: `undefined` carries the calendar forward untouched (explicit or
  // absent, exactly as it was); a string explicitly (re)pins a calendar,
  // always resolved fresh to its current latest version (unchanged prior
  // behavior — resubmitting the same calendar id on purpose is how an
  // explicit pin picks up a newer calendar version); `null` explicitly
  // clears to "use the organization's default calendar" — carried forward
  // without recomputing when it was already absent, so resubmitting an
  // already-absent calendar never churns a spurious new version.
  let calendarVersionId: string;
  let desiredCalendarIsExplicit: boolean;
  if (input.calendarId === undefined) {
    calendarVersionId = latestVersion.calendarVersionId;
    desiredCalendarIsExplicit = latestVersion.calendarIsExplicit;
  } else if (input.calendarId === null) {
    desiredCalendarIsExplicit = false;
    calendarVersionId = !latestVersion.calendarIsExplicit
      ? latestVersion.calendarVersionId
      : await resolveFallbackCalendarVersionId(prisma, organizationId);
  } else {
    desiredCalendarIsExplicit = true;
    calendarVersionId = await resolveCalendarVersionId(prisma, organizationId, input.calendarId);
  }

  if (input.name && input.name !== policy.name) {
    await prisma.sLAPolicy.update({
      where: { id: policyId },
      data: { name: input.name },
    });
  }

  const desiredMatch = input.match ?? (latestVersion.match as SLAPolicyMatch);
  const desiredTargets =
    input.targets ??
    (latestVersion.targets as { kind: CommitmentKind; minutes: number }[]);

  const unchanged = policyVersionContentEquals(
    {
      match: latestVersion.match as SLAPolicyMatch,
      targets: latestVersion.targets as {
        kind: CommitmentKind;
        minutes: number;
      }[],
      calendarVersionId: latestVersion.calendarVersionId,
    },
    { match: desiredMatch, targets: desiredTargets, calendarVersionId },
  );
  const warnAtPercentChanged =
    input.warnAtPercent &&
    JSON.stringify([...input.warnAtPercent].sort()) !==
      JSON.stringify([...latestVersion.warnAtPercent].sort());

  if (unchanged && !warnAtPercentChanged) {
    return {
      created: false,
      policyId,
      version: { id: latestVersion.id, version: latestVersion.version },
    };
  }

  const version = await prisma.sLAPolicyVersion.create({
    data: {
      policyId,
      version: latestVersion.version + 1,
      match: desiredMatch as unknown as Prisma.InputJsonValue,
      targets: desiredTargets as unknown as Prisma.InputJsonValue,
      pauseOnStates: latestVersion.pauseOnStates,
      calendarVersionId,
      calendarIsExplicit: desiredCalendarIsExplicit,
      warnAtPercent: input.warnAtPercent ?? latestVersion.warnAtPercent,
      effectiveFrom: new Date(),
      source: "native",
    },
  });

  return {
    created: true,
    policyId,
    version: { id: version.id, version: version.version },
  };
}

/**
 * Pause or resume a native policy (task 4.4). A deactivated policy is
 * excluded from matching for new/re-resolved commitments, same as an
 * archived (Zendesk-deleted) one — see the `deactivatedAt: null` filter
 * alongside `archivedAt: null` in packages/commitments' three matching
 * queries. Only usable on a native policy; an imported policy's lifecycle is
 * controlled by Zendesk, not this.
 */
export async function setPolicyActive(
  prisma: PrismaClient,
  organizationId: string,
  policyId: string,
  active: boolean,
): Promise<void> {
  const policy = await prisma.sLAPolicy.findFirst({
    where: { id: policyId, organizationId },
  });
  if (!policy) throw new PolicyNotFoundError(policyId);
  if (policy.source !== "native") throw new NotANativePolicyError(policyId);

  await prisma.sLAPolicy.update({
    where: { id: policyId },
    data: { deactivatedAt: active ? null : new Date() },
  });
}
