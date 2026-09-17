import { describe, expect, it } from "vitest";
import { commitmentPausesOn, pauseStatesFor } from "../src/clock-rules";
import type { NormalizedState, SLAPolicyVersion } from "../src/types";

const policy: SLAPolicyVersion = {
  id: "policy-v1",
  policyId: "policy",
  version: 1,
  match: {},
  targets: [
    { kind: "first_response", minutes: 60 },
    { kind: "resolution", minutes: 480 },
  ],
  pauseOnStates: ["pending_customer"],
  calendarVersionId: "cal",
  warnAtPercent: [50, 80, 95],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
};

const ALL_STATES: NormalizedState[] = [
  "new",
  "open",
  "pending_customer",
  "pending_internal",
  "in_progress",
  "escalated",
  "resolved",
  "closed",
];

describe("pauseStatesFor", () => {
  it("gives first response no pause states, whatever the policy configures", () => {
    expect(pauseStatesFor("first_response", policy)).toEqual([]);
    expect(pauseStatesFor("first_response", { ...policy, pauseOnStates: ALL_STATES })).toEqual([]);
  });

  it("gives resolution exactly the policy's pause states", () => {
    expect(pauseStatesFor("resolution", policy)).toEqual(["pending_customer"]);
    expect(pauseStatesFor("resolution", { ...policy, pauseOnStates: [] })).toEqual([]);
    expect(pauseStatesFor("resolution", { ...policy, pauseOnStates: ["pending_customer", "pending_internal"] })).toEqual([
      "pending_customer",
      "pending_internal",
    ]);
  });
});

describe("commitmentPausesOn", () => {
  it("never pauses first response", () => {
    for (const state of ALL_STATES) expect(commitmentPausesOn("first_response", state, policy)).toBe(false);
  });

  it("pauses resolution only on the policy's pause states", () => {
    for (const state of ALL_STATES) {
      expect(commitmentPausesOn("resolution", state, policy)).toBe(state === "pending_customer");
    }
  });
});
