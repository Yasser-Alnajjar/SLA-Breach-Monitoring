import { describe, expect, it } from "vitest";
import { createCommitment, matchPolicyVersion } from "../src/commitments.js";
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

describe("matchPolicyVersion", () => {
  it("matches the most specific policy first", () => {
    const caseAttributes: CaseAttributes = {
      caseId: "case-1",
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
    const caseAttributes: CaseAttributes = { caseId: "case-1", priority: "P3" };
    const match = matchPolicyVersion(caseAttributes, [p1Policy, p1Tier1Policy]);
    expect(match).toBeNull();
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
