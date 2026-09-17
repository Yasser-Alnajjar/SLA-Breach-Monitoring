import { describe, expect, it } from "vitest";
import {
  extractMatchFromFilter,
  groupPolicyMetricsByPriority,
  policyVersionContentEquals,
  resolvePolicyCalendarVersion,
} from "../src/policies";
import type { ZendeskSlaPolicy, ZendeskSlaPolicyMetric } from "../src/types";

describe("extractMatchFromFilter", () => {
  it("maps a single priority condition to match.priority", () => {
    const { match, unsupportedConditions } = extractMatchFromFilter(
      { all: [{ field: "priority", operator: "is", value: "urgent" }] },
      new Map(),
    );
    expect(match).toEqual({ priority: ["urgent"] });
    expect(unsupportedConditions).toBe(0);
  });

  it("folds all + any priority conditions into one OR-set", () => {
    const { match } = extractMatchFromFilter(
      {
        all: [{ field: "priority", operator: "is", value: "urgent" }],
        any: [{ field: "priority", operator: "is", value: "high" }],
      },
      new Map(),
    );
    expect(match.priority?.sort()).toEqual(["high", "urgent"]);
  });

  it("translates an organization_id condition to our internal Customer id", () => {
    const customerIdsByZendeskOrgId = new Map([["7", "cust_abc"]]);
    const { match } = extractMatchFromFilter(
      { all: [{ field: "organization_id", operator: "is", value: 7 }] },
      customerIdsByZendeskOrgId,
    );
    expect(match).toEqual({ customerIds: ["cust_abc"] });
  });

  it("silently excludes an organization_id with no known Customer", () => {
    const { match } = extractMatchFromFilter(
      { all: [{ field: "organization_id", operator: "is", value: "999" }] },
      new Map(),
    );
    expect(match).toEqual({});
  });

  it("counts conditions on unsupported fields without throwing", () => {
    const { match, unsupportedConditions } = extractMatchFromFilter(
      { all: [{ field: "group_id", operator: "is", value: 42 }] },
      new Map(),
    );
    expect(match).toEqual({});
    expect(unsupportedConditions).toBe(1);
  });

  it("returns an empty match (matches everything) for an undefined filter", () => {
    expect(extractMatchFromFilter(undefined, new Map())).toEqual({ match: {}, unsupportedConditions: 0 });
  });
});

describe("groupPolicyMetricsByPriority", () => {
  function metric(overrides: Partial<ZendeskSlaPolicyMetric>): ZendeskSlaPolicyMetric {
    return { priority: null, metric: "first_reply_time", target: 60, business_hours: true, ...overrides };
  }

  it("maps first_reply_time and total_resolution_time to their CommitmentKind", () => {
    const { groups, unsupportedMetrics } = groupPolicyMetricsByPriority([
      metric({ metric: "first_reply_time", target: 60 }),
      metric({ metric: "total_resolution_time", target: 480 }),
    ]);
    expect(groups).toEqual([
      {
        priority: null,
        targets: [
          { kind: "first_response", minutes: 60 },
          { kind: "resolution", minutes: 480 },
        ],
      },
    ]);
    expect(unsupportedMetrics).toBe(0);
  });

  it("splits metrics into separate groups per priority tier", () => {
    const { groups } = groupPolicyMetricsByPriority([
      metric({ priority: "urgent", metric: "first_reply_time", target: 30 }),
      metric({ priority: "low", metric: "first_reply_time", target: 240 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.priority === "urgent")?.targets).toEqual([{ kind: "first_response", minutes: 30 }]);
    expect(groups.find((g) => g.priority === "low")?.targets).toEqual([{ kind: "first_response", minutes: 240 }]);
  });

  it("lowercases priority so it matches Zendesk ticket priority values", () => {
    const { groups } = groupPolicyMetricsByPriority([metric({ priority: "Urgent" })]);
    expect(groups[0]?.priority).toBe("urgent");
  });

  it("drops and counts metrics with no CommitmentKind equivalent", () => {
    const { groups, unsupportedMetrics } = groupPolicyMetricsByPriority([
      metric({ metric: "requester_wait_time" }),
      metric({ metric: "first_reply_time" }),
    ]);
    expect(groups).toEqual([{ priority: null, targets: [{ kind: "first_response", minutes: 60 }] }]);
    expect(unsupportedMetrics).toBe(1);
  });

  it("returns no groups for an undefined metrics array", () => {
    expect(groupPolicyMetricsByPriority(undefined)).toEqual({ groups: [], unsupportedMetrics: 0 });
  });
});

describe("policyVersionContentEquals", () => {
  const base = {
    match: { priority: ["urgent"] },
    targets: [{ kind: "first_response" as const, minutes: 60 }],
    calendarVersionId: "cal_1",
  };

  it("is true for identical content", () => {
    expect(policyVersionContentEquals(base, { ...base })).toBe(true);
  });

  it("ignores array order in match and targets", () => {
    const reordered = {
      match: { priority: ["high", "urgent"] },
      targets: [
        { kind: "resolution" as const, minutes: 480 },
        { kind: "first_response" as const, minutes: 60 },
      ],
      calendarVersionId: "cal_1",
    };
    const same = {
      match: { priority: ["urgent", "high"] },
      targets: [
        { kind: "first_response" as const, minutes: 60 },
        { kind: "resolution" as const, minutes: 480 },
      ],
      calendarVersionId: "cal_1",
    };
    expect(policyVersionContentEquals(reordered, same)).toBe(true);
  });

  it("is false when a target's minutes changed", () => {
    expect(
      policyVersionContentEquals(base, { ...base, targets: [{ kind: "first_response", minutes: 30 }] }),
    ).toBe(false);
  });

  it("is false when the calendar version changed", () => {
    expect(policyVersionContentEquals(base, { ...base, calendarVersionId: "cal_2" })).toBe(false);
  });
});

describe("resolvePolicyCalendarVersion", () => {
  function policy(overrides: Partial<ZendeskSlaPolicy>): ZendeskSlaPolicy {
    return { id: 1, title: "Policy", ...overrides };
  }
  const defaultCalendar = { id: "cal_default" };

  it("uses the default calendar when the policy has no schedule_id", () => {
    const result = resolvePolicyCalendarVersion(policy({ schedule_id: null }), new Map(), defaultCalendar);
    expect(result).toEqual({ calendarVersionId: "cal_default", scheduleUnresolved: false });
  });

  it("uses the imported schedule's calendar when it resolves", () => {
    const byScheduleId = new Map([[42, { id: "cal_42" }]]);
    const result = resolvePolicyCalendarVersion(policy({ schedule_id: 42 }), byScheduleId, defaultCalendar);
    expect(result).toEqual({ calendarVersionId: "cal_42", scheduleUnresolved: false });
  });

  it("falls back to the default and reports unresolved when the schedule isn't imported yet", () => {
    const result = resolvePolicyCalendarVersion(policy({ schedule_id: 99 }), new Map(), defaultCalendar);
    expect(result).toEqual({ calendarVersionId: "cal_default", scheduleUnresolved: true });
  });
});
