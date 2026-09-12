import type { PrismaClient } from "@sla/db";
import { getSlaPolicies } from "./sla-policies-data";
import { getBusinessCalendars, getCustomerCalendarSummaries } from "./customer-calendars-data";
import type { SlaConfigurationData } from "./types/sla-configuration";

/**
 * Assembles the SLA configuration page's read model — engineering leg
 * target, SLA policy overrides, and customer calendar overrides — split out
 * of the integrations settings page since none of these are provider-specific.
 */
export async function getSlaConfigurationData(
  prisma: PrismaClient,
  organizationId: string,
): Promise<SlaConfigurationData> {
  const [organization, slaPolicies, businessCalendars, customerCalendars] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { engineeringLegTargetMinutes: true },
      }),
      getSlaPolicies(prisma, organizationId),
      getBusinessCalendars(prisma, organizationId),
      getCustomerCalendarSummaries(prisma, organizationId),
    ]);

  return {
    engineeringLegTargetMinutes:
      organization?.engineeringLegTargetMinutes ?? null,
    slaPolicies,
    businessCalendars,
    customerCalendars,
  };
}
