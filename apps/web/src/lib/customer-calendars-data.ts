import type { WeeklyWindow } from "@sla/core";
import type { NativeHolidayInput } from "@sla/commitments";
import type { PrismaClient } from "@sla/db";
import type { BusinessCalendarOption, CustomerCalendarSummary } from "./types/sla-configuration";

/** Every `BusinessCalendar` an org already has — imported Zendesk schedules plus the always-open default — for the customer calendar override picker (roadmap step 24) and the calendar editor (task 4.6). Calendars with no version yet are excluded; they have nothing a commitment could anchor to. */
export async function getBusinessCalendars(prisma: PrismaClient, organizationId: string): Promise<BusinessCalendarOption[]> {
  const calendars = await prisma.businessCalendar.findMany({
    where: { organizationId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return calendars
    .filter((calendar) => calendar.versions[0])
    .map((calendar) => {
      const version = calendar.versions[0]!;
      const holidayNames = (version.holidayNames ?? {}) as Record<string, string>;
      // 4h: prefer the editor's original recurring/one-off inputs when this
      // version has them, so reopening it round-trips a recurring holiday
      // as recurring — never reconstructed as a pile of one-off dates.
      // Falls back to the flat expanded dates (always one-off) for a
      // version with no native-editor inputs at all (every pre-4h version,
      // and every Zendesk-imported version).
      const holidays: NativeHolidayInput[] = version.holidayDefinitions
        ? (version.holidayDefinitions as unknown as NativeHolidayInput[])
        : version.holidays.map((date) => ({
            date,
            name: holidayNames[date] ?? "",
            recurring: false,
          }));
      return {
        id: calendar.id,
        name: calendar.name,
        source: calendar.source,
        alwaysOpen: version.alwaysOpen,
        timezone: version.timezone,
        createdAt: calendar.createdAt.toISOString(),
        weekly: version.weekly as unknown as WeeklyWindow[],
        holidays,
      };
    });
}

/** Every customer in the org and its current calendar override, if any (roadmap step 24). */
export async function getCustomerCalendarSummaries(
  prisma: PrismaClient,
  organizationId: string,
): Promise<CustomerCalendarSummary[]> {
  return prisma.customer.findMany({
    where: { organizationId },
    select: { id: true, name: true, tier: true, calendarId: true },
    orderBy: { name: "asc" },
  });
}
