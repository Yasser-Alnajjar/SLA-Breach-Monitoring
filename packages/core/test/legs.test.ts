import { describe, expect, it } from "vitest";
import { deriveLegSpans, sumLegMinutes, validateLegSpans } from "../src/legs.js";
import type { LegSpan, NormalizedEvent } from "../src/types";

let seq = 0;
function event(
  partial: Partial<NormalizedEvent> &
    Pick<NormalizedEvent, "occurredAt" | "system" | "type">,
): NormalizedEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    caseId: "case-1",
    actor: "agent",
    fromState: null,
    toState: null,
    sourceRawEventId: `raw-${seq}`,
    ...partial,
  };
}

describe("deriveLegSpans", () => {
  it("derives a clean handoff timeline: support -> engineering -> support -> waiting_customer -> support", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "jira",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "issue_unlinked",
        system: "jira",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "open",
        toState: "pending_customer",
        occurredAt: "2026-09-07T12:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "zendesk",
        fromState: "pending_customer",
        toState: "open",
        occurredAt: "2026-09-07T13:00:00.000Z",
      }),
    ];

    const { spans, warnings } = deriveLegSpans(events);

    expect(warnings).toHaveLength(0);
    expect(
      spans.map((s) => [s.leg, s.confidence, s.startedAt, s.endedAt]),
    ).toEqual([
      [
        "support",
        "certain",
        "2026-09-07T09:00:00.000Z",
        "2026-09-07T10:00:00.000Z",
      ],
      [
        "engineering",
        "certain",
        "2026-09-07T10:00:00.000Z",
        "2026-09-07T11:00:00.000Z",
      ],
      [
        "support",
        "certain",
        "2026-09-07T11:00:00.000Z",
        "2026-09-07T12:00:00.000Z",
      ],
      [
        "waiting_customer",
        "certain",
        "2026-09-07T12:00:00.000Z",
        "2026-09-07T13:00:00.000Z",
      ],
      ["support", "certain", "2026-09-07T13:00:00.000Z", null],
    ]);
  });

  it("emits an unknown span with a warning on an ambiguous (contemporaneous) handoff", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "jira",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "issue_unlinked",
        system: "jira",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
    ];

    const { spans, warnings } = deriveLegSpans(events);

    expect(warnings.some((w) => w.kind === "ambiguous_handoff")).toBe(true);
    const ambiguousSpan = spans.find(
      (s) => s.startedAt === "2026-09-07T10:00:00.000Z",
    );
    expect(ambiguousSpan?.leg).toBe("unknown");
    expect(ambiguousSpan?.confidence).toBe("unknown");
  });

  it("bounds a missing handoff event to the case's open time and marks it inferred", () => {
    const events = [
      event({
        type: "issue_linked",
        system: "jira",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
    ];

    const { spans } = deriveLegSpans(events, {
      caseOpenedAt: "2026-09-07T08:00:00.000Z",
    });

    expect(spans[0]).toMatchObject({
      leg: "engineering",
      confidence: "inferred",
      startedAt: "2026-09-07T08:00:00.000Z",
    });
    expect(spans[0]?.note).toContain("bounded by case open");
  });

  it("attributes multiple linked issues to a single engineering leg and notes the count", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "jira",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "jira",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
    ];

    const { spans } = deriveLegSpans(events);
    const engineeringSpan = spans.find((s) => s.leg === "engineering");

    expect(engineeringSpan?.note).toBe(
      "2 linked issues — attributed as one engineering leg",
    );
  });

  it("attributes a Linear-linked issue to the engineering leg the same way as a Jira one", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "linear",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
    ];

    const { spans } = deriveLegSpans(events);
    expect(spans[spans.length - 1]).toMatchObject({ leg: "engineering", confidence: "certain" });
  });

  it("ends the engineering leg once the linked issue resolves, regardless of which tracker it's in", () => {
    const events = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: "open",
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
      event({
        type: "issue_linked",
        system: "linear",
        occurredAt: "2026-09-07T10:00:00.000Z",
      }),
      event({
        type: "state_changed",
        system: "linear",
        fromState: "in_progress",
        toState: "resolved",
        occurredAt: "2026-09-07T11:00:00.000Z",
      }),
    ];

    const { spans } = deriveLegSpans(events);
    expect(
      spans.map((s) => [s.leg, s.startedAt, s.endedAt]),
    ).toEqual([
      ["support", "2026-09-07T09:00:00.000Z", "2026-09-07T10:00:00.000Z"],
      ["engineering", "2026-09-07T10:00:00.000Z", "2026-09-07T11:00:00.000Z"],
      ["support", "2026-09-07T11:00:00.000Z", null],
    ]);
  });

  it("never guesses: absent signals produce an unknown span rather than a default leg", () => {
    const noSignalEvents = [
      event({
        type: "case_created",
        system: "zendesk",
        toState: null,
        occurredAt: "2026-09-07T09:00:00.000Z",
      }),
    ];
    const { spans } = deriveLegSpans(noSignalEvents);
    expect(spans[0]).toMatchObject({ leg: "unknown", confidence: "unknown" });
  });
});

describe("validateLegSpans", () => {
  it("flags a negative-duration span without altering it", () => {
    const spans: LegSpan[] = [
      {
        leg: "support",
        confidence: "certain",
        startedAt: "2026-09-07T12:00:00.000Z",
        endedAt: "2026-09-07T10:00:00.000Z",
      },
    ];
    const warnings = validateLegSpans(spans);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe("impossible_span");
    expect(spans[0]?.endedAt).toBe("2026-09-07T10:00:00.000Z"); // untouched — never silently normalized
  });

  it("flags overlapping consecutive spans", () => {
    const spans: LegSpan[] = [
      {
        leg: "support",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: "2026-09-07T12:00:00.000Z",
      },
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T11:00:00.000Z",
        endedAt: null,
      },
    ];
    const warnings = validateLegSpans(spans);
    expect(warnings.some((w) => w.kind === "impossible_span")).toBe(true);
  });

  it("returns no warnings for a well-formed, contiguous timeline", () => {
    const spans: LegSpan[] = [
      {
        leg: "support",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: "2026-09-07T10:00:00.000Z",
      },
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T10:00:00.000Z",
        endedAt: null,
      },
    ];
    expect(validateLegSpans(spans)).toHaveLength(0);
  });
});

describe("sumLegMinutes", () => {
  it("sums a single closed span", () => {
    const spans: LegSpan[] = [
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: "2026-09-07T11:00:00.000Z",
      },
    ];
    expect(sumLegMinutes(spans, "engineering", "2026-09-07T12:00:00.000Z")).toBe(120);
  });

  it("bounds a still-open span by asOf", () => {
    const spans: LegSpan[] = [
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: null,
      },
    ];
    expect(sumLegMinutes(spans, "engineering", "2026-09-07T09:30:00.000Z")).toBe(30);
  });

  it("accumulates across multiple non-contiguous spans of the same leg", () => {
    const spans: LegSpan[] = [
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: "2026-09-07T10:00:00.000Z",
      },
      {
        leg: "support",
        confidence: "certain",
        startedAt: "2026-09-07T10:00:00.000Z",
        endedAt: "2026-09-07T10:30:00.000Z",
      },
      {
        leg: "engineering",
        confidence: "certain",
        startedAt: "2026-09-07T10:30:00.000Z",
        endedAt: null,
      },
    ];
    expect(sumLegMinutes(spans, "engineering", "2026-09-07T11:00:00.000Z")).toBe(90);
  });

  it("returns 0 when the leg never occurs", () => {
    const spans: LegSpan[] = [
      {
        leg: "support",
        confidence: "certain",
        startedAt: "2026-09-07T09:00:00.000Z",
        endedAt: null,
      },
    ];
    expect(sumLegMinutes(spans, "engineering", "2026-09-07T12:00:00.000Z")).toBe(0);
  });
});
