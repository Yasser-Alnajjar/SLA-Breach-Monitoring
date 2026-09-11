import { describe, expect, it } from "vitest";
import {
  deriveCaseClosedAt,
  deriveNormalizedEventsForTicket,
  normalizeZendeskStatus,
  resolveActor,
  sortAuditsChronologically,
  UnknownZendeskStatusError,
  type AuditRecord,
  type DerivedNormalizedEvent,
} from "../src/normalize";
import type { ZendeskAudit, ZendeskTicket } from "../src/types";

const ticket: ZendeskTicket = {
  id: 42,
  url: "https://acme.zendesk.com/api/v2/tickets/42.json",
  external_id: null,
  subject: "Cannot log in to account",
  created_at: "2026-01-01T09:00:00Z",
  updated_at: "2026-01-03T12:00:00Z",
  status: "closed",
  priority: "high",
  organization_id: 7,
  requester_id: 501,
  via: { channel: "web" },
};

function audit(overrides: Partial<ZendeskAudit> & { id: number }): AuditRecord {
  return {
    rawEventId: `raw_${overrides.id}`,
    audit: {
      ticket_id: 42,
      created_at: "2026-01-01T09:00:00Z",
      author_id: 501,
      events: [],
      ...overrides,
    },
  };
}

function statusChange(value: string, previous_value: string) {
  return { id: 1, type: "Change", field_name: "status", value, previous_value };
}

describe("normalizeZendeskStatus", () => {
  it("maps every known Zendesk status", () => {
    expect(normalizeZendeskStatus("new")).toBe("new");
    expect(normalizeZendeskStatus("open")).toBe("open");
    expect(normalizeZendeskStatus("pending")).toBe("pending_customer");
    expect(normalizeZendeskStatus("hold")).toBe("pending_internal");
    expect(normalizeZendeskStatus("solved")).toBe("resolved");
    expect(normalizeZendeskStatus("closed")).toBe("closed");
  });

  it("throws a named error on an unrecognized status", () => {
    expect(() => normalizeZendeskStatus("bogus")).toThrow(UnknownZendeskStatusError);
  });
});

describe("resolveActor", () => {
  it("attributes a trigger/automation/rule channel to the system, regardless of author", () => {
    expect(resolveActor("trigger", 501, ticket)).toBe("system");
    expect(resolveActor("automation", 999, ticket)).toBe("system");
    expect(resolveActor("rule", 999, ticket)).toBe("system");
  });

  it("attributes the ticket's requester to the customer", () => {
    expect(resolveActor("web", 501, ticket)).toBe("customer");
  });

  it("defaults to agent for anyone else", () => {
    expect(resolveActor("web", 999, ticket)).toBe("agent");
  });

  it("defaults to agent when the requester is unknown", () => {
    expect(resolveActor("web", 501, { ...ticket, requester_id: null })).toBe("agent");
  });
});

describe("sortAuditsChronologically", () => {
  it("orders by created_at, then by audit id as a tiebreaker", () => {
    const a = audit({ id: 3, created_at: "2026-01-01T10:00:00Z" });
    const b = audit({ id: 1, created_at: "2026-01-01T09:00:00Z" });
    const c = audit({ id: 2, created_at: "2026-01-01T09:00:00Z" });
    expect(sortAuditsChronologically([a, b, c]).map((r) => r.rawEventId)).toEqual([
      "raw_1",
      "raw_2",
      "raw_3",
    ]);
  });
});

describe("deriveNormalizedEventsForTicket", () => {
  it("synthesizes case_created from the ticket snapshot when there are no audits", () => {
    const events = deriveNormalizedEventsForTicket({ ...ticket, status: "new" }, [], "raw_ticket_42");
    expect(events).toEqual([
      {
        type: "case_created",
        occurredAt: ticket.created_at,
        actor: "customer",
        fromState: null,
        toState: "new",
        sourceRawEventId: "raw_ticket_42",
      },
    ]);
  });

  it("takes the initial state from the first status Change event's previous_value", () => {
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        author_id: 501,
        via: { channel: "web" },
        events: [statusChange("open", "new")],
      }),
    ];
    const events = deriveNormalizedEventsForTicket({ ...ticket, status: "open" }, audits, "raw_ticket_42");
    expect(events[0]).toMatchObject({ type: "case_created", fromState: null, toState: "new" });
    expect(events[1]).toMatchObject({
      type: "state_changed",
      fromState: "new",
      toState: "open",
      sourceRawEventId: "raw_1",
    });
  });

  it("emits case_closed instead of state_changed for the transition into solved or closed", () => {
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        author_id: 501,
        via: { channel: "web" },
        events: [statusChange("open", "new")],
      }),
      audit({
        id: 2,
        created_at: "2026-01-02T09:00:00Z",
        author_id: 900,
        via: { channel: "web" },
        events: [statusChange("solved", "open")],
      }),
      audit({
        id: 3,
        created_at: "2026-01-03T12:00:00Z",
        author_id: 900,
        via: { channel: "trigger" },
        events: [statusChange("closed", "solved")],
      }),
    ];
    const events = deriveNormalizedEventsForTicket(ticket, audits, "raw_ticket_42");

    expect(events.map((e) => e.type)).toEqual([
      "case_created",
      "state_changed",
      "case_closed",
      "case_closed",
    ]);
    const solved = events[2];
    expect(solved).toMatchObject({
      type: "case_closed",
      fromState: "open",
      toState: "resolved",
      actor: "agent",
      sourceRawEventId: "raw_2",
    });
    const closed = events[3];
    expect(closed).toMatchObject({
      type: "case_closed",
      fromState: "resolved",
      toState: "closed",
      actor: "system",
      sourceRawEventId: "raw_3",
    });
  });

  it("emits a plain state_changed when a solved ticket is reopened", () => {
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        author_id: 501,
        via: { channel: "web" },
        events: [statusChange("open", "new")],
      }),
      audit({
        id: 2,
        created_at: "2026-01-02T09:00:00Z",
        author_id: 900,
        via: { channel: "web" },
        events: [statusChange("solved", "open")],
      }),
      audit({
        id: 3,
        created_at: "2026-01-02T15:00:00Z",
        author_id: 501,
        via: { channel: "web" },
        events: [statusChange("open", "solved")],
      }),
    ];
    const events = deriveNormalizedEventsForTicket({ ...ticket, status: "open" }, audits, "raw_ticket_42");

    expect(events.map((e) => e.type)).toEqual(["case_created", "state_changed", "case_closed", "state_changed"]);
    expect(events[3]).toMatchObject({ type: "state_changed", fromState: "resolved", toState: "open" });
  });

  it("resolves each transition's actor independently from its own audit", () => {
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        author_id: 501, // the requester
        via: { channel: "web" },
        events: [statusChange("open", "new")],
      }),
      audit({
        id: 2,
        created_at: "2026-01-02T09:00:00Z",
        author_id: 900, // an agent
        via: { channel: "web" },
        events: [statusChange("pending", "open")],
      }),
    ];
    const events = deriveNormalizedEventsForTicket({ ...ticket, status: "pending" }, audits, "raw_ticket_42");
    expect(events[1]?.actor).toBe("customer");
    expect(events[2]?.actor).toBe("agent");
  });

  it("ignores non-status Change events and other event types", () => {
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        events: [
          { id: 1, type: "Change", field_name: "priority", value: "urgent", previous_value: "high" },
          { id: 2, type: "Comment", body: "looking into it" },
        ],
      }),
    ];
    const events = deriveNormalizedEventsForTicket({ ...ticket, status: "new" }, audits, "raw_ticket_42");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("case_created");
  });
});

describe("deriveCaseClosedAt", () => {
  const solvedEvent: DerivedNormalizedEvent = {
    type: "case_closed",
    occurredAt: "2026-01-02T09:00:00Z",
    actor: "agent",
    fromState: "open",
    toState: "resolved",
    sourceRawEventId: "raw_2",
  };
  const closedEvent: DerivedNormalizedEvent = {
    type: "case_closed",
    occurredAt: "2026-01-03T12:00:00Z",
    actor: "system",
    fromState: "resolved",
    toState: "closed",
    sourceRawEventId: "raw_3",
  };
  const createdEvent: DerivedNormalizedEvent = {
    type: "case_created",
    occurredAt: "2026-01-01T09:00:00Z",
    actor: "customer",
    fromState: null,
    toState: "open",
    sourceRawEventId: "raw_ticket_42",
  };

  it("is set from the solved transition when the ticket is currently solved", () => {
    const closedAt = deriveCaseClosedAt({ ...ticket, status: "solved" }, [createdEvent, solvedEvent]);
    expect(closedAt?.toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });

  it("is set from the closed transition when the ticket is currently closed", () => {
    const closedAt = deriveCaseClosedAt({ ...ticket, status: "closed" }, [createdEvent, solvedEvent, closedEvent]);
    expect(closedAt?.toISOString()).toBe("2026-01-03T12:00:00.000Z");
  });

  it("is null for an open, pending, new, or on-hold ticket", () => {
    for (const status of ["new", "open", "pending", "hold"]) {
      expect(deriveCaseClosedAt({ ...ticket, status }, [createdEvent])).toBeNull();
    }
  });

  it("is null again once a solved ticket is reopened, even though a case_closed event exists in its history", () => {
    const reopened: DerivedNormalizedEvent = {
      type: "state_changed",
      occurredAt: "2026-01-02T15:00:00Z",
      actor: "customer",
      fromState: "resolved",
      toState: "open",
      sourceRawEventId: "raw_4",
    };
    const closedAt = deriveCaseClosedAt({ ...ticket, status: "open" }, [createdEvent, solvedEvent, reopened]);
    expect(closedAt).toBeNull();
  });

  it("falls back to the ticket's updated_at when no case_closed event was derived", () => {
    const closedAt = deriveCaseClosedAt({ ...ticket, status: "solved", updated_at: "2026-01-05T00:00:00Z" }, [
      { ...createdEvent, toState: "resolved" },
    ]);
    expect(closedAt?.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("uses the most recent case_closed event when the ticket was solved more than once", () => {
    const secondSolve: DerivedNormalizedEvent = {
      type: "case_closed",
      occurredAt: "2026-01-04T10:00:00Z",
      actor: "agent",
      fromState: "open",
      toState: "resolved",
      sourceRawEventId: "raw_5",
    };
    const closedAt = deriveCaseClosedAt({ ...ticket, status: "solved" }, [createdEvent, solvedEvent, secondSolve]);
    expect(closedAt?.toISOString()).toBe("2026-01-04T10:00:00.000Z");
  });

  it("is idempotent: re-deriving from the same solved ticket and audits twice yields identical output", () => {
    const solvedTicket = { ...ticket, status: "solved" };
    const audits = [
      audit({
        id: 1,
        created_at: "2026-01-01T09:05:00Z",
        author_id: 501,
        via: { channel: "web" },
        events: [statusChange("open", "new")],
      }),
      audit({
        id: 2,
        created_at: "2026-01-02T09:00:00Z",
        author_id: 900,
        via: { channel: "web" },
        events: [statusChange("solved", "open")],
      }),
    ];

    const run = () => {
      const derived = deriveNormalizedEventsForTicket(solvedTicket, audits, "raw_ticket_42");
      return { derived, closedAt: deriveCaseClosedAt(solvedTicket, derived) };
    };

    const first = run();
    const second = run();
    expect(second.derived).toEqual(first.derived);
    expect(second.closedAt?.toISOString()).toBe(first.closedAt?.toISOString());
    expect(first.derived.map((e) => e.type)).toEqual(["case_created", "state_changed", "case_closed"]);
  });
});
