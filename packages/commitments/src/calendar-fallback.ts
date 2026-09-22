import type { PrismaClient } from "@sla/db";
import type { BusinessCalendarVersion } from "@sla/core";
import { toCalendarVersionDomain } from "./calendar-domain";
import { ensureDefaultCalendarVersion } from "./default-calendar";

export interface OrganizationCalendarFallback {
  /** The organization's current default calendar's latest version, or null when it has none set (or the setting points at a calendar with no version). */
  organizationDefault: BusinessCalendarVersion | null;
  /**
   * The system Always Open calendar — resolved (and created if the
   * organization doesn't have one yet) only the first time it's actually
   * needed and memoized after that, so an organization with a valid default
   * calendar never pays for this lookup at all.
   */
  getAlwaysOpen: () => Promise<BusinessCalendarVersion>;
}

/**
 * Resolves the two fallback tiers a native policy with no explicit calendar
 * uses (4i): the organization's own default calendar, then the system Always
 * Open calendar. Always evaluated fresh (never cached across calls) — the
 * whole point of "no explicit calendar" is that it tracks whatever the
 * organization's default currently is, not a snapshot from whenever the
 * policy was last saved.
 */
export async function resolveOrganizationCalendarFallback(
  prisma: PrismaClient,
  organizationId: string,
): Promise<OrganizationCalendarFallback> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { defaultCalendarId: true },
  });

  let organizationDefault: BusinessCalendarVersion | null = null;
  if (org?.defaultCalendarId) {
    const calendar = await prisma.businessCalendar.findFirst({
      where: { id: org.defaultCalendarId, organizationId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (calendar?.versions[0]) organizationDefault = toCalendarVersionDomain(calendar.versions[0]);
  }

  let alwaysOpenPromise: Promise<BusinessCalendarVersion> | null = null;
  const getAlwaysOpen = () =>
    (alwaysOpenPromise ??= ensureDefaultCalendarVersion(prisma, organizationId).then(toCalendarVersionDomain));

  return { organizationDefault, getAlwaysOpen };
}

/**
 * Which calendar version a matched policy's own assignment contributes for a
 * *new* commitment (4i) — the resolution order's tiers 1-2-3 minus the
 * customer-override tier, which stays a separate, higher-precedence check
 * (`resolveCommitmentCalendarVersion`, pipeline.ts) exactly as before this
 * fix.
 *
 * `calendarIsExplicit` (true/absent, the database default) means the policy
 * stays pinned to the specific version already frozen onto it — unchanged,
 * append-only contract, same as every other versioned reference in this
 * schema. `false` — only ever set by `createNativePolicy`/`updateNativePolicy`
 * when the caller explicitly left the calendar unset — resolves fresh, every
 * time, to the organization's current default calendar, or the system
 * Always Open calendar when the organization has none, rather than the
 * stale snapshot `calendarVersionId` happened to hold when the version was
 * last saved.
 *
 * Never touches an existing commitment or an already-created
 * `SLAPolicyVersion` row — only which version gets frozen onto a brand new
 * `Commitment.calendarVersionId`.
 */
export async function resolveEffectiveCalendarVersion(
  calendarIsExplicit: boolean | undefined,
  frozenCalendarVersion: BusinessCalendarVersion,
  fallback: OrganizationCalendarFallback,
): Promise<BusinessCalendarVersion> {
  if (calendarIsExplicit ?? true) return frozenCalendarVersion;
  return fallback.organizationDefault ?? (await fallback.getAlwaysOpen());
}
