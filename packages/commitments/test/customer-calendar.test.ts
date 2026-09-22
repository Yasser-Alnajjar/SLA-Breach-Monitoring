import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@sla/db";
import { CalendarNotFoundError, CustomerNotFoundError, setCustomerCalendar } from "../src/customer-calendar";

interface CustomerRow {
  id: string;
  organizationId: string;
}

interface CalendarRow {
  id: string;
  organizationId: string;
  versions: { id: string; version: number }[];
}

/**
 * In-memory stand-in for the delegates `setCustomerCalendar` touches. Lookups
 * honor both `id` and `organizationId`, so dropping the tenant scope from
 * either query would make the cross-tenant tests below fail.
 */
function fakePrisma(customers: CustomerRow[], calendars: CalendarRow[]) {
  const updates: { where: { id: string }; data: { calendarId: string | null; calendarVersionId: string | null } }[] =
    [];
  const prisma = {
    customer: {
      findFirst: async ({ where }: { where: CustomerRow }) =>
        customers.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null,
      update: async (args: (typeof updates)[number]) => {
        updates.push(args);
        return {};
      },
    },
    businessCalendar: {
      findFirst: async ({ where }: { where: CalendarRow }) =>
        calendars.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null,
    },
  };
  return { prisma: prisma as unknown as PrismaClient, updates };
}

const customers: CustomerRow[] = [
  { id: "cust_a", organizationId: "org_a" },
  { id: "cust_b", organizationId: "org_b" },
];
const calendars: CalendarRow[] = [
  { id: "cal_a", organizationId: "org_a", versions: [{ id: "calv_a2", version: 2 }, { id: "calv_a1", version: 1 }] },
  { id: "cal_b", organizationId: "org_b", versions: [{ id: "calv_b1", version: 1 }] },
];

describe("setCustomerCalendar", () => {
  it("assigns a calendar from the same organization, pinned to its current latest version (4d)", async () => {
    const { prisma, updates } = fakePrisma(customers, calendars);

    await setCustomerCalendar(prisma, "org_a", "cust_a", "cal_a");

    expect(updates).toEqual([
      { where: { id: "cust_a" }, data: { calendarId: "cal_a", calendarVersionId: "calv_a2" } },
    ]);
  });

  it("clears the assignment with null without looking up a calendar", async () => {
    const { prisma, updates } = fakePrisma(customers, []);

    await setCustomerCalendar(prisma, "org_a", "cust_a", null);

    expect(updates).toEqual([
      { where: { id: "cust_a" }, data: { calendarId: null, calendarVersionId: null } },
    ]);
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
