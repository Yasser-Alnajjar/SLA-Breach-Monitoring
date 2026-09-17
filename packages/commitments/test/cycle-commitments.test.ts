import { describe, expect, it } from "vitest";
import type { NextReplyCycle } from "@sla/core";
import { planCycleCommitments, type CycleCommitmentRecord } from "../src/cycle-commitments";

function cycle(key: string, index = 0): NextReplyCycle {
  const anchor = {
    sourceRawEventId: `raw_${key}`,
    system: "zendesk" as const,
    type: "customer_replied" as const,
    occurredAt: "2026-09-17T09:00:00.000Z",
  };
  return {
    key,
    index,
    startedAt: anchor.occurredAt,
    anchor,
    customerReplies: [anchor],
    completedAt: null,
    completion: null,
    completionType: null,
  };
}

const row = (
  id: string,
  cycleKey: string,
  status: CycleCommitmentRecord["status"] = "on_track",
  closedAt: Date | null = null,
) => ({
  id,
  cycleKey,
  status,
  closedAt,
});

/** A finalized row, as `evaluate-pipeline.ts` would leave it: terminal status, real `closedAt`. */
const finalized = (id: string, cycleKey: string, status: "met" | "breached", closedAt = new Date("2026-09-17T12:00:00.000Z")) =>
  row(id, cycleKey, status, closedAt);

describe("planCycleCommitments", () => {
  it("creates a commitment for every cycle on a case with none", () => {
    const plan = planCycleCommitments([], [cycle("a", 0), cycle("b", 1), cycle("c", 2)]);
    expect(plan.create.map((c) => c.key)).toEqual(["a", "b", "c"]);
    expect(plan).toMatchObject({ cancel: [], restore: [] });
  });

  it("matches by cycle key alone, so re-derived cycles keep their commitments whatever their status or index", () => {
    const existing = [row("c1", "a", "met"), row("c2", "b", "breached")];
    // A new cycle derived before "a" shifts every index; identity doesn't move.
    const plan = planCycleCommitments(existing, [cycle("new", 0), cycle("a", 1), cycle("b", 2)]);
    expect(plan.create.map((c) => c.key)).toEqual(["new"]);
    expect(plan).toMatchObject({ cancel: [], restore: [] });
  });

  it("is empty once applied: re-planning the same cycles writes nothing", () => {
    const cycles = [cycle("a"), cycle("b", 1)];
    expect(planCycleCommitments([row("c1", "a"), row("c2", "b", "at_risk")], cycles)).toEqual({
      create: [],
      cancel: [],
      restore: [],
    });
  });

  it("cancels an unfinalized commitment whose cycle is no longer derived", () => {
    // item 5: unfinalized commitment + cycle disappears -> still gets cancelled.
    const plan = planCycleCommitments([row("c1", "a"), row("c2", "b", "at_risk")], [cycle("b")]);
    expect(plan).toEqual({ create: [], cancel: ["c1"], restore: [] });
  });

  it("never cancels a finalized met commitment whose cycle is no longer derived", () => {
    // item 1: finalized `met` commitment + cycle disappears -> remains `met`.
    const plan = planCycleCommitments([finalized("c1", "a", "met"), row("c2", "b")], [cycle("b")]);
    expect(plan).toEqual({ create: [], cancel: [], restore: [] });
  });

  it("never cancels a finalized breached commitment whose cycle is no longer derived", () => {
    // item 2: finalized `breached` commitment + cycle disappears -> remains `breached`.
    const plan = planCycleCommitments([finalized("c1", "a", "breached"), row("c2", "b")], [cycle("b")]);
    expect(plan).toEqual({ create: [], cancel: [], restore: [] });
  });

  it("cancels only the still-unfinalized rows out of a mixed set whose cycles all disappeared", () => {
    const existing = [finalized("c1", "a", "met"), row("c2", "b"), finalized("c3", "c", "breached"), row("c4", "d", "at_risk")];
    const plan = planCycleCommitments(existing, []);
    expect(plan).toEqual({ create: [], cancel: ["c2", "c4"], restore: [] });
  });

  it("leaves an already-cancelled commitment alone while its cycle stays gone", () => {
    expect(planCycleCommitments([row("c1", "a", "cancelled", new Date("2026-09-17T12:00:00.000Z"))], [])).toEqual({
      create: [],
      cancel: [],
      restore: [],
    });
  });

  it("restores a cancelled commitment when its cycle is derived again instead of creating a duplicate", () => {
    // item 6: previously-cancelled unfinalized commitment + cycle reappears -> restores.
    const plan = planCycleCommitments([row("c1", "a", "cancelled", new Date("2026-09-17T12:00:00.000Z"))], [cycle("a")]);
    expect(plan).toEqual({ create: [], cancel: [], restore: ["c1"] });
  });

  it("rejects derived cycles that share a key", () => {
    expect(() => planCycleCommitments([], [cycle("a"), cycle("a", 1)])).toThrow(/Duplicate Next Reply cycle key/);
  });
});
