import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@sla/db";
import { CalendarNotFoundError, CustomerNotFoundError, setCustomerCalendar } from "../src/customer-calendar";

interface Row {
  id: string;
  organizationId: string;
}

/**
 * In-memory stand-in for the delegates `setCustomerCalendar` touches. Lookups
 * honor both `id` and `organizationId`, so dropping the tenant scope from
 * either query would make the cross-tenant tests below fail.
 */
function fakePrisma(customers: Row[], calendars: Row[]) {
  const updates: { where: { id: string }; data: { calendarId: string | null } }[] = [];
  const byTenant =
    (rows: Row[]) =>
    async ({ where }: { where: Row }) =>
      rows.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null;
  const prisma = {
    customer: {
      findFirst: byTenant(customers),
      update: async (args: (typeof updates)[number]) => {
        updates.push(args);
        return {};
      },
    },
    businessCalendar: { findFirst: byTenant(calendars) },
  };
  return { prisma: prisma as unknown as PrismaClient, updates };
}

const customers: Row[] = [
  { id: "cust_a", organizationId: "org_a" },
  { id: "cust_b", organizationId: "org_b" },
];
const calendars: Row[] = [
  { id: "cal_a", organizationId: "org_a" },
  { id: "cal_b", organizationId: "org_b" },
];

describe("setCustomerCalendar", () => {
  it("assigns a calendar from the same organization", async () => {
    const { prisma, updates } = fakePrisma(customers, calendars);

    await setCustomerCalendar(prisma, "org_a", "cust_a", "cal_a");

    expect(updates).toEqual([{ where: { id: "cust_a" }, data: { calendarId: "cal_a" } }]);
  });

  it("clears the assignment with null without looking up a calendar", async () => {
    const { prisma, updates } = fakePrisma(customers, []);

    await setCustomerCalendar(prisma, "org_a", "cust_a", null);

    expect(updates).toEqual([{ where: { id: "cust_a" }, data: { calendarId: null } }]);
  });

  it("refuses another organization's calendar and writes nothing", async () => {
    const { prisma, updates } = fakePrisma(customers, calendars);

    await expect(setCustomerCalendar(prisma, "org_a", "cust_a", "cal_b")).rejects.toBeInstanceOf(
      CalendarNotFoundError,
    );
    expect(updates).toHaveLength(0);
  });

  it("refuses an unknown calendar id", async () => {
    const { prisma, updates } = fakePrisma(customers, calendars);

    await expect(setCustomerCalendar(prisma, "org_a", "cust_a", "cal_missing")).rejects.toThrow(
      "Business calendar cal_missing not found",
    );
    expect(updates).toHaveLength(0);
  });

  it("refuses another organization's customer, even with that organization's own calendar", async () => {
    const { prisma, updates } = fakePrisma(customers, calendars);

    await expect(setCustomerCalendar(prisma, "org_a", "cust_b", "cal_b")).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
    await expect(setCustomerCalendar(prisma, "org_a", "cust_b", null)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
    expect(updates).toHaveLength(0);
  });

  it("refuses an unknown customer id", async () => {
    const { prisma } = fakePrisma(customers, calendars);

    await expect(setCustomerCalendar(prisma, "org_a", "cust_missing", "cal_a")).rejects.toThrow(
      "Customer cust_missing not found",
    );
  });
});
