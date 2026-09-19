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

  it("gives resolution the policy's pause states plus `resolved` unconditionally (D3)", () => {
    expect(pauseStatesFor("resolution", policy)).toEqual(["pending_customer", "resolved"]);
    expect(pauseStatesFor("resolution", { ...policy, pauseOnStates: [] })).toEqual(["resolved"]);
    expect(new Set(pauseStatesFor("resolution", { ...policy, pauseOnStates: ["pending_customer", "pending_internal"] }))).toEqual(
      new Set(["pending_customer", "pending_internal", "resolved"]),
    );
  });

  it("never duplicates `resolved` when the policy already pauses on it", () => {
    expect(pauseStatesFor("resolution", { ...policy, pauseOnStates: ["resolved"] })).toEqual(["resolved"]);
  });

  it("gives next reply no pause states, whatever the policy configures", () => {
    expect(pauseStatesFor("next_reply", { ...policy, pauseOnStates: ALL_STATES })).toEqual([]);
  });
});

describe("commitmentPausesOn", () => {
  it("never pauses first response", () => {
    for (const state of ALL_STATES) expect(commitmentPausesOn("first_response", state, policy)).toBe(false);
  });

  it("pauses resolution on the policy's pause states plus `resolved` (D3)", () => {
    for (const state of ALL_STATES) {
      expect(commitmentPausesOn("resolution", state, policy)).toBe(
        state === "pending_customer" || state === "resolved",
      );
    }
  });

  it("never pauses next reply, not even on pending", () => {
    for (const state of ALL_STATES) expect(commitmentPausesOn("next_reply", state, policy)).toBe(false);
  });
});
