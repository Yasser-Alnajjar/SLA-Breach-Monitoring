import { describe, expect, it } from "vitest";
import { createCommitment, matchPolicyVersion, resolveCommitmentPolicyChange } from "../src/commitments.js";
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

  it("keys a single-cycle kind as the one cycle of its kind on the case", () => {
    const commitment = createCommitment("case-1", "resolution", "2026-09-07T09:00:00.000Z", p1Policy, calendar);
    expect(commitment.cycleKey).toBe(SINGLE_CYCLE_KEY);
  });

  it("keeps the given cycle key for a next reply cycle and starts at that cycle", () => {
    const policy: SLAPolicyVersion = { ...p1Policy, targets: [{ kind: "next_reply", minutes: 60 }] };
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
      cycleKey: "next_reply:zendesk:raw_7:customer_replied:2026-09-07T10:00:00.000Z",
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
    const resolution = resolveCommitmentPolicyChange({ kind: "resolution" }, genericPolicy.policyId, genericPolicy);
    expect(resolution).toEqual({ changed: false, hasTarget: true });
  });

  it("D1: reports no change for a new version of the SAME policy — an override, re-import, or policy-UI edit never re-resolves", () => {
    // p1Policy and p1Tier1Policy share policyId "policy" and differ only by
    // version and match criteria — exactly what a policy edit looks like.
    const resolution = resolveCommitmentPolicyChange({ kind: "resolution" }, p1Policy.policyId, p1Tier1Policy);
    expect(resolution).toEqual({ changed: false, hasTarget: true });
  });

  it("reports a change generically when a genuinely different policy now matches — the comparison never inspects which CaseAttributes field moved", () => {
    // genericPolicy and otherPolicy have different policyIds: a real switch,
    // not merely a new version of the commitment's current policy.
    const resolution = resolveCommitmentPolicyChange({ kind: "resolution" }, genericPolicy.policyId, otherPolicy);
    expect(resolution).toEqual({ changed: true, hasTarget: true });
  });

  it("flags a missing target when the newly matched (different) policy has no target for the commitment's kind", () => {
    const noNextReply: SLAPolicyVersion = { ...otherPolicy, id: "policy-no-next-reply" };
    const resolution = resolveCommitmentPolicyChange({ kind: "next_reply" }, genericPolicy.policyId, noNextReply);
    expect(resolution).toEqual({ changed: true, hasTarget: false });
  });
});
