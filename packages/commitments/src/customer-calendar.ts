import type { PrismaClient } from "@sla/db";

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`Customer ${customerId} not found`);
  }
}

export class CalendarNotFoundError extends Error {
  constructor(calendarId: string) {
    super(`Business calendar ${calendarId} not found`);
  }
}

/**
 * Assigns, or clears with `calendarId: null`, the `BusinessCalendar` a
 * customer's future commitments should anchor to (roadmap step 24) — e.g. a
 * contractually 24/7 enterprise-tier calendar in place of whatever the
 * matched `SLAPolicyVersion` would otherwise resolve to. `calendarId` must
 * belong to the same organization as the customer, so this can't be used to
 * point one tenant's customer at another tenant's calendar. Only affects
 * commitments created after the change — `Commitment.calendarVersionId`
 * stays frozen at creation like everywhere else in this pipeline.
 */
export async function setCustomerCalendar(
  prisma: PrismaClient,
  organizationId: string,
  customerId: string,
  calendarId: string | null,
): Promise<void> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });
  if (!customer) throw new CustomerNotFoundError(customerId);

  if (calendarId !== null) {
    const calendar = await prisma.businessCalendar.findFirst({ where: { id: calendarId, organizationId } });
    if (!calendar) throw new CalendarNotFoundError(calendarId);
  }

  await prisma.customer.update({ where: { id: customerId }, data: { calendarId } });
}
