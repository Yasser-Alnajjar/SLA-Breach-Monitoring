import type { PrismaClient } from "@sla/db";
import type { BusinessCalendarOption, CustomerCalendarSummary } from "./types/integrations";

/** Every `BusinessCalendar` an org already has — imported Zendesk schedules plus the always-open default — for the customer calendar override picker (roadmap step 24). Calendars with no version yet are excluded; they have nothing a commitment could anchor to. */
export async function getBusinessCalendars(prisma: PrismaClient, organizationId: string): Promise<BusinessCalendarOption[]> {
  const calendars = await prisma.businessCalendar.findMany({
    where: { organizationId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return calendars
    .filter((calendar) => calendar.versions[0])
    .map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      alwaysOpen: calendar.versions[0]!.alwaysOpen,
      timezone: calendar.versions[0]!.timezone,
    }));
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
