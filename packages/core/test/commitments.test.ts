import { describe, expect, it } from "vitest";
import {
  createCommitment,
  matchPolicyVersion,
  resolveCommitmentPolicyChange,
} from "../src/commitments.js";
import { SINGLE_CYCLE_KEY } from "../src/types";
import type {
  BusinessCalendarVersion,
  CaseAttributes,
  SLAPolicyVersion,
} from "../src/types";

const calendar: BusinessCalendarVersion = {
  id: "cal-24-7",
  version: 1,
  timezone: "UTC",
  weekly: [],
  holidays: [],
  alwaysOpen: true,
};

const genericPolicy: SLAPolicyVersion = {
  id: "policy-generic",
  policyId: "policy",
  version: 1,
  match: {},
  targets: [{ kind: "resolution", minutes: 480 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const p1Policy: SLAPolicyVersion = {
  id: "policy-p1",
  policyId: "policy",
  version: 2,
  match: { priority: ["P1"] },
  targets: [{ kind: "resolution", minutes: 240 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const p1Tier1Policy: SLAPolicyVersion = {
  id: "policy-p1-tier1",
  policyId: "policy",
  version: 3,
  match: { priority: ["P1"], tier: ["tier1"] },
  targets: [{ kind: "resolution", minutes: 120 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const otherPolicy: SLAPolicyVersion = {
  id: "policy-other-v1",
  policyId: "policy-other",
  version: 1,
  match: { priority: ["P1"] },
  targets: [{ kind: "resolution", minutes: 90 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const d6TagPolicy: SLAPolicyVersion = {
  id: "policy-d6-tag",
  policyId: "policy-d6-tag",
  version: 1,
  match: {
    conditions: {
      all: [
        {
          field: "priority",
          operator: "is",
          value: "urgent",
        },
        {
          field: "tags",
          operator: "contains",
          value: "d6-test",
        },
      ],
    },
  },
  targets: [{ kind: "resolution", minutes: 10 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const d6GroupPolicy: SLAPolicyVersion = {
  id: "policy-d6-group",
  policyId: "policy-d6-group",
  version: 1,
  match: {
    conditions: {
      all: [
        {
          field: "group_id",
          operator: "is",
          value: 42,
        },
      ],
    },
  },
  targets: [{ kind: "resolution", minutes: 20 }],
  pauseOnStates: [],
  calendarVersionId: calendar.id,
  warnAtPercent: [80],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

describe("matchPolicyVersion", () => {
  it("matches the most specific policy first", () => {
    const caseAttributes: CaseAttributes = {
      caseId: "case-1",
      attributes: {},
      priority: "P1",
      tier: "tier1",
    };

    const match = matchPolicyVersion(caseAttributes, [
      genericPolicy,
      p1Policy,
      p1Tier1Policy,
    ]);

    expect(match?.id).toBe("policy-p1-tier1");
  });

  it("falls back to a less specific policy when the most specific doesn't match", () => {
    const caseAttributes: CaseAttributes = {
      caseId: "case-1",
      attributes: {},
      priority: "P1",
      tier: "tier2",
    };

    const match = matchPolicyVersion(caseAttributes, [
      genericPolicy,
      p1Policy,
      p1Tier1Policy,
    ]);

    expect(match?.id).toBe("policy-p1");
  });

  it("returns null when nothing matches", () => {
    const caseAttributes: CaseAttributes = {
      caseId: "case-1",
      attributes: {},
      priority: "P3",
    };

    const match = matchPolicyVersion(caseAttributes, [p1Policy, p1Tier1Policy]);

    expect(match).toBeNull();
  });

  describe("generic conditions", () => {
    it("matches an arbitrary condition against generic case attributes", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          tags: ["d6-test", "customer-visible"],
        },
        priority: "urgent",
      };

      const match = matchPolicyVersion(caseAttributes, [d6TagPolicy]);

      expect(match?.id).toBe("policy-d6-tag");
    });

    it("does not match when an all condition is missing", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          tags: ["customer-visible"],
        },
        priority: "urgent",
      };

      const match = matchPolicyVersion(caseAttributes, [d6TagPolicy]);

      expect(match).toBeNull();
    });

    it("does not broaden a policy when an arbitrary condition is missing", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-85",
        attributes: {
          tags: [],
        },
        priority: "urgent",
      };

      const match = matchPolicyVersion(caseAttributes, [d6TagPolicy]);

      expect(match).toBeNull();
    });

    it("supports arbitrary fields without adding dedicated CaseAttributes properties", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          group_id: 42,
        },
      };

      const match = matchPolicyVersion(caseAttributes, [d6GroupPolicy]);

      expect(match?.id).toBe("policy-d6-group");
    });

    it("fails closed for an unknown operator", () => {
      const policy: SLAPolicyVersion = {
        ...d6TagPolicy,
        id: "policy-unknown-operator",
        match: {
          conditions: {
            all: [
              {
                field: "tags",
                operator: "future_operator_that_is_not_supported",
                value: "d6-test",
              },
            ],
          },
        },
      };

      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          tags: ["d6-test"],
        },
      };

      expect(matchPolicyVersion(caseAttributes, [policy])).toBeNull();
    });

    it("requires every condition in all to match", () => {
      const policy: SLAPolicyVersion = {
        ...d6TagPolicy,
        id: "policy-all",
        match: {
          conditions: {
            all: [
              {
                field: "priority",
                operator: "is",
                value: "urgent",
              },
              {
                field: "tags",
                operator: "contains",
                value: "d6-test",
              },
            ],
          },
        },
      };

      const matchingCase: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          tags: ["d6-test"],
        },
        priority: "urgent",
      };

      const nonMatchingCase: CaseAttributes = {
        caseId: "case-2",
        attributes: {
          tags: ["d6-test"],
        },
        priority: "normal",
      };

      expect(matchPolicyVersion(matchingCase, [policy])?.id).toBe("policy-all");
      expect(matchPolicyVersion(nonMatchingCase, [policy])).toBeNull();
    });

    it("requires at least one condition in any to match", () => {
      const policy: SLAPolicyVersion = {
        ...d6TagPolicy,
        id: "policy-any",
        match: {
          conditions: {
            any: [
              {
                field: "tags",
                operator: "contains",
                value: "d6-test",
              },
              {
                field: "type",
                operator: "is",
                value: "incident",
              },
            ],
          },
        },
      };

      const tagCase: CaseAttributes = {
        caseId: "case-1",
        attributes: {
          tags: ["d6-test"],
        },
      };

      const typeCase: CaseAttributes = {
        caseId: "case-2",
        attributes: {
          type: "incident",
        },
      };

      const nonMatchingCase: CaseAttributes = {
        caseId: "case-3",
        attributes: {
          type: "question",
          tags: ["customer-visible"],
        },
      };

      expect(matchPolicyVersion(tagCase, [policy])?.id).toBe("policy-any");
      expect(matchPolicyVersion(typeCase, [policy])?.id).toBe("policy-any");
      expect(matchPolicyVersion(nonMatchingCase, [policy])).toBeNull();
    });

    it("does not match a Zendesk high-priority policy when its required tag is absent", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-85",
        attributes: {
          tags: [],
        },
        priority: "urgent",
      };

      const match = matchPolicyVersion(caseAttributes, [d6TagPolicy]);

      expect(match).toBeNull();
    });

    it("matches a Zendesk high-priority policy when its required tag is present", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-85",
        attributes: {
          tags: ["d6-test"],
        },
        priority: "urgent",
      };

      const match = matchPolicyVersion(caseAttributes, [d6TagPolicy]);

      expect(match?.id).toBe("policy-d6-tag");
    });
  });

  describe("D6: imported Zendesk position outranks specificity", () => {
    it("prefers the lower position even when it's less specific", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {},
        priority: "P1",
        tier: "tier1",
      };

      const lowPositionGeneric: SLAPolicyVersion = {
        ...genericPolicy,
        id: "generic-pos-1",
        policyPosition: 1,
      };

      const higherPositionSpecific: SLAPolicyVersion = {
        ...p1Tier1Policy,
        id: "specific-pos-5",
        policyPosition: 5,
      };

      const match = matchPolicyVersion(caseAttributes, [
        higherPositionSpecific,
        lowPositionGeneric,
      ]);

      expect(match?.id).toBe("generic-pos-1");
    });

    it("a positioned version always outranks an unpositioned one, regardless of specificity", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {},
        priority: "P1",
        tier: "tier1",
      };

      const positioned: SLAPolicyVersion = {
        ...genericPolicy,
        id: "positioned",
        policyPosition: 3,
      };

      const unpositionedSpecific: SLAPolicyVersion = {
        ...p1Tier1Policy,
        id: "unpositioned",
        policyPosition: null,
      };

      expect(
        matchPolicyVersion(caseAttributes, [unpositionedSpecific, positioned])
          ?.id,
      ).toBe("positioned");

      expect(
        matchPolicyVersion(caseAttributes, [positioned, unpositionedSpecific])
          ?.id,
      ).toBe("positioned");
    });

    it("falls back to specificity when positions tie (fanned-out priority groups of one Zendesk policy)", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {},
        priority: "P1",
        tier: "tier1",
      };

      const genericSamePos: SLAPolicyVersion = {
        ...genericPolicy,
        id: "same-pos-generic",
        policyPosition: 2,
      };

      const specificSamePos: SLAPolicyVersion = {
        ...p1Tier1Policy,
        id: "same-pos-specific",
        policyPosition: 2,
      };

      expect(
        matchPolicyVersion(caseAttributes, [genericSamePos, specificSamePos])
          ?.id,
      ).toBe("same-pos-specific");
    });

    it("falls back to specificity when neither candidate has a position (manual policies, or pre-D6 imports)", () => {
      const caseAttributes: CaseAttributes = {
        caseId: "case-1",
        attributes: {},
        priority: "P1",
        tier: "tier1",
      };

      const match = matchPolicyVersion(caseAttributes, [
        genericPolicy,
        p1Policy,
        p1Tier1Policy,
      ]);

      expect(match?.id).toBe("policy-p1-tier1");
    });
  });
});

describe("createCommitment", () => {
  it("freezes the policy and calendar version ids onto the commitment", () => {
    const commitment = createCommitment(
      "case-1",
      "resolution",
      "2026-09-07T09:00:00.000Z",
      p1Policy,
      calendar,
    );

    expect(commitment.policyVersionId).toBe(p1Policy.id);
    expect(commitment.calendarVersionId).toBe(calendar.id);
    expect(commitment.targetMinutes).toBe(240);
    expect(commitment.dueAt).toBe("2026-09-07T13:00:00.000Z");
    expect(commitment.status).toBe("on_track");
  });

  it("keys a single-cycle kind as the one cycle of its kind on the case", () => {
    const commitment = createCommitment(
      "case-1",
      "resolution",
      "2026-09-07T09:00:00.000Z",
      p1Policy,
      calendar,
    );

    expect(commitment.cycleKey).toBe(SINGLE_CYCLE_KEY);
  });

  it("keeps the given cycle key for a next reply cycle and starts at that cycle", () => {
    const policy: SLAPolicyVersion = {
      ...p1Policy,
      targets: [{ kind: "next_reply", minutes: 60 }],
    };

    const commitment = createCommitment(
      "case-1",
      "next_reply",
      "2026-09-07T10:00:00.000Z",
      policy,
      calendar,
      "next_reply:zendesk:raw_7:customer_replied:2026-09-07T10:00:00.000Z",
    );

    expect(commitment).toMatchObject({
      kind: "next_reply",
      cycleKey:
        "next_reply:zendesk:raw_7:customer_replied:2026-09-07T10:00:00.000Z",
      startedAt: "2026-09-07T10:00:00.000Z",
      targetMinutes: 60,
      dueAt: "2026-09-07T11:00:00.000Z",
    });
  });

  it("throws when the policy has no target for the requested kind", () => {
    expect(() =>
      createCommitment(
        "case-1",
        "first_response",
        "2026-09-07T09:00:00.000Z",
        p1Policy,
        calendar,
      ),
    ).toThrow();
  });
});

describe("resolveCommitmentPolicyChange", () => {
  it("reports no change when the matched policy version is the commitment's current one", () => {
    const resolution = resolveCommitmentPolicyChange(
      { kind: "resolution" },
      genericPolicy.policyId,
      genericPolicy,
    );

    expect(resolution).toEqual({
      changed: false,
      hasTarget: true,
    });
  });

  it("D1: reports no change for a new version of the SAME policy — an override, re-import, or policy-UI edit never re-resolves", () => {
    const resolution = resolveCommitmentPolicyChange(
      { kind: "resolution" },
      p1Policy.policyId,
      p1Tier1Policy,
    );

    expect(resolution).toEqual({
      changed: false,
      hasTarget: true,
    });
  });

  it("reports a change generically when a genuinely different policy now matches — the comparison never inspects which CaseAttributes field moved", () => {
    const resolution = resolveCommitmentPolicyChange(
      { kind: "resolution" },
      genericPolicy.policyId,
      otherPolicy,
    );

    expect(resolution).toEqual({
      changed: true,
      hasTarget: true,
    });
  });

  it("flags a missing target when the newly matched (different) policy has no target for the commitment's kind", () => {
    const noNextReply: SLAPolicyVersion = {
      ...otherPolicy,
      id: "policy-no-next-reply",
    };

    const resolution = resolveCommitmentPolicyChange(
      { kind: "next_reply" },
      genericPolicy.policyId,
      noNextReply,
    );

    expect(resolution).toEqual({
      changed: true,
      hasTarget: false,
    });
  });
});
