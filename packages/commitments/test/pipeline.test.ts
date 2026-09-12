import { describe, expect, it } from "vitest";
import type { BusinessCalendarVersion } from "@sla/core";
import {
  latestVersionPerPolicy,
  missingCommitmentKinds,
  resolveCommitmentCalendarVersion,
  toCaseAttributes,
  type PolicyVersionRecord,
} from "../src/pipeline";

function version(overrides: Partial<PolicyVersionRecord> & { id: string; policyId: string; version: number }): PolicyVersionRecord {
  return {
    match: {},
    targets: [],
    pauseOnStates: [],
    calendarVersionId: "cal_1",
    warnAtPercent: [50, 80, 95],
    effectiveFrom: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("latestVersionPerPolicy", () => {
  it("keeps only the highest version for each policyId", () => {
    const versions = [
      version({ id: "v1", policyId: "p1", version: 1 }),
      version({ id: "v2", policyId: "p1", version: 2 }),
      version({ id: "v3", policyId: "p2", version: 1 }),
    ];
    const active = latestVersionPerPolicy(versions);
    expect(active).toHaveLength(2);
    expect(active.find((v) => v.policyId === "p1")?.id).toBe("v2");
    expect(active.find((v) => v.policyId === "p2")?.id).toBe("v3");
  });

  it("is order-independent", () => {
    const versions = [
      version({ id: "v2", policyId: "p1", version: 2 }),
      version({ id: "v1", policyId: "p1", version: 1 }),
    ];
    expect(latestVersionPerPolicy(versions).map((v) => v.id)).toEqual(["v2"]);
  });

  it("returns an empty array for no versions", () => {
    expect(latestVersionPerPolicy([])).toEqual([]);
  });
});

describe("missingCommitmentKinds", () => {
  it("returns both kinds when a case has neither", () => {
    expect(missingCommitmentKinds([])).toEqual(["first_response", "resolution"]);
  });

  it("returns only the kind not already present", () => {
    expect(missingCommitmentKinds(["first_response"])).toEqual(["resolution"]);
  });

  it("returns nothing once both kinds exist", () => {
    expect(missingCommitmentKinds(["first_response", "resolution"])).toEqual([]);
  });
});

describe("toCaseAttributes", () => {
  it("maps null fields to undefined so packages/core's optional matching treats them as absent", () => {
    expect(
      toCaseAttributes({ id: "case_1", priority: null, customerId: null, tier: null, openedAt: new Date() }),
    ).toEqual({ caseId: "case_1", priority: undefined, customerId: undefined, tier: undefined });
  });

  it("passes through defined fields", () => {
    expect(
      toCaseAttributes({
        id: "case_1",
        priority: "urgent",
        customerId: "cust_1",
        tier: "gold",
        openedAt: new Date(),
      }),
    ).toEqual({ caseId: "case_1", priority: "urgent", customerId: "cust_1", tier: "gold" });
  });
});

function calendarVersion(overrides: Partial<BusinessCalendarVersion> & { id: string }): BusinessCalendarVersion {
  return { version: 1, timezone: "UTC", weekly: [], holidays: [], alwaysOpen: true, ...overrides };
}

describe("resolveCommitmentCalendarVersion", () => {
  it("prefers the customer's calendar override when one is set", () => {
    const policyCalendar = calendarVersion({ id: "cal_org" });
    const customerCalendar = calendarVersion({ id: "cal_customer" });
    expect(resolveCommitmentCalendarVersion(policyCalendar, customerCalendar)).toBe(customerCalendar);
  });

  it("falls back to the policy's calendar when the customer has no override", () => {
    const policyCalendar = calendarVersion({ id: "cal_org" });
    expect(resolveCommitmentCalendarVersion(policyCalendar, undefined)).toBe(policyCalendar);
  });
});
