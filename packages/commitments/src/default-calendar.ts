import type { PrismaClient } from "@sla/db";

export const DEFAULT_CALENDAR_NAME = "Default (always open)";

export interface DefaultCalendarVersionRow {
  id: string;
  version: number;
  timezone: string;
  weekly: unknown;
  holidays: string[];
  alwaysOpen: boolean;
}

/**
 * Ensures the organization has a system-provided, always-open business
 * calendar to fall back to — originally written for the Zendesk importer
 * (a policy anchored to an unresolvable schedule), and reused by native
 * policy/commitment resolution (4i) for a policy with no explicit calendar
 * and no organization default: a pure-native org that never connected a
 * ticket source may never have created this calendar any other way. Moved
 * here (from packages/zendesk) so both callers share one implementation —
 * packages/zendesk re-exports it unchanged for its existing callers/tests.
 */
export async function ensureDefaultCalendarVersion(
  prisma: PrismaClient,
  organizationId: string,
): Promise<DefaultCalendarVersionRow> {
  const existing = await prisma.businessCalendar.findFirst({
    where: { organizationId, name: DEFAULT_CALENDAR_NAME },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (existing?.versions[0]) return existing.versions[0];

  const created = await prisma.businessCalendar.create({
    data: {
      organizationId,
      name: DEFAULT_CALENDAR_NAME,
      // Not Zendesk-imported content — a system-provided fallback, same as a
      // manually-created calendar (Phase 4 / D12).
      source: "native",
      versions: {
        create: {
          version: 1,
          timezone: "UTC",
          weekly: [],
          holidays: [],
          alwaysOpen: true,
          source: "native",
        },
      },
    },
    include: { versions: true },
  });
  return created.versions[0]!;
}
