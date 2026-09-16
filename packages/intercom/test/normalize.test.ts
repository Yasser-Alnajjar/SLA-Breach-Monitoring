import { describe, expect, it } from "vitest";
import {
  deriveCaseClosedAt,
  deriveIntercomSubject,
  deriveNormalizedEventsForConversation,
  normalizeIntercomPriority,
  normalizeIntercomState,
  resolveIntercomActor,
  sortPartsChronologically,
  UnknownIntercomStateError,
  type ConversationPartRecord,
  type DerivedNormalizedEvent,
} from "../src/normalize";
import type { IntercomConversationPart, IntercomConversationWithParts } from "../src/types";

const conversation: IntercomConversationWithParts = {
  id: "42",
  created_at: 1_700_000_000, // 2023-11-14T22:13:20Z
  updated_at: 1_700_100_000,
  state: "closed",
  source: { type: "conversation", author: { type: "user", id: "u1" } },
};

function part(overrides: Partial<IntercomConversationPart> & { id: string }): ConversationPartRecord {
  return {
    rawEventId: `raw_${overrides.id}`,
    part: {
      part_type: "comment",
      created_at: conversation.created_at + 100,
      author: { type: "admin", id: "admin-1" },
      ...overrides,
    },
  };
}

describe("normalizeIntercomState", () => {
  it("maps every known Intercom state", () => {
    expect(normalizeIntercomState("open")).toBe("open");
    expect(normalizeIntercomState("snoozed")).toBe("pending_internal");
    expect(normalizeIntercomState("closed")).toBe("resolved");
  });

  it("throws a named error on an unrecognized state", () => {
    expect(() => normalizeIntercomState("bogus")).toThrow(UnknownIntercomStateError);
  });
});

describe("resolveIntercomActor", () => {
  it("attributes a bot/team/operator author to the system", () => {
    expect(resolveIntercomActor({ type: "bot" })).toBe("system");
    expect(resolveIntercomActor({ type: "team" })).toBe("system");
    expect(resolveIntercomActor({ type: "operator" })).toBe("system");
  });

  it("attributes a user/lead/contact author to the customer", () => {
    expect(resolveIntercomActor({ type: "user" })).toBe("customer");
    expect(resolveIntercomActor({ type: "lead" })).toBe("customer");
    expect(resolveIntercomActor({ type: "contact" })).toBe("customer");
  });

  it("attributes an admin author to the agent", () => {
    expect(resolveIntercomActor({ type: "admin" })).toBe("agent");
  });

  it("attributes a missing author to the system", () => {
    expect(resolveIntercomActor(null)).toBe("system");
    expect(resolveIntercomActor(undefined)).toBe("system");
  });
});

describe("sortPartsChronologically", () => {
  it("orders by created_at, then by part id as a tiebreaker", () => {
    const a = part({ id: "c", created_at: 10 });
    const b = part({ id: "a", created_at: 5 });
    const c = part({ id: "b", created_at: 5 });
    expect(sortPartsChronologically([a, b, c]).map((r) => r.rawEventId)).toEqual(["raw_a", "raw_b", "raw_c"]);
  });
});

describe("deriveNormalizedEventsForConversation", () => {
  it("synthesizes case_created as open, from the conversation's own source author, when there are no parts", () => {
    const events = deriveNormalizedEventsForConversation(conversation, [], "raw_conversation_42");
    expect(events).toEqual([
      {
        type: "case_created",
        occurredAt: new Date(conversation.created_at * 1000).toISOString(),
        actor: "customer",
        fromState: null,
        toState: "open",
        sourceRawEventId: "raw_conversation_42",
      },
    ]);
  });

  it("replays a close part as case_closed, tracking state from open", () => {
    const parts = [part({ id: "1", part_type: "close", created_at: conversation.created_at + 100 })];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "case_closed",
      fromState: "open",
      toState: "resolved",
      actor: "agent",
      sourceRawEventId: "raw_1",
    });
  });

  it("replays snoozed then close as two ordered transitions", () => {
    const parts = [
      part({ id: "1", part_type: "snoozed", created_at: conversation.created_at + 100 }),
      part({ id: "2", part_type: "close", created_at: conversation.created_at + 200 }),
    ];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");

    expect(events.map((e) => e.type)).toEqual(["case_created", "state_changed", "case_closed"]);
    expect(events[1]).toMatchObject({ fromState: "open", toState: "pending_internal" });
    expect(events[2]).toMatchObject({ fromState: "pending_internal", toState: "resolved" });
  });

  it("emits a plain state_changed when a closed conversation is reopened", () => {
    const parts = [
      part({ id: "1", part_type: "close", created_at: conversation.created_at + 100 }),
      part({ id: "2", part_type: "open", created_at: conversation.created_at + 200 }),
    ];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");

    expect(events.map((e) => e.type)).toEqual(["case_created", "case_closed", "state_changed"]);
    expect(events[2]).toMatchObject({ fromState: "resolved", toState: "open" });
  });

  it("skips a transition part whose target state matches the currently-tracked state", () => {
    const parts = [
      part({ id: "1", part_type: "close", created_at: conversation.created_at + 100 }),
      // A redundant re-close (e.g. two close webhooks for the same event) — must not double-emit.
      part({ id: "2", part_type: "close", created_at: conversation.created_at + 200 }),
    ];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");
    expect(events.map((e) => e.type)).toEqual(["case_created", "case_closed"]);
  });

  it("ignores non-transition part types", () => {
    const parts = [
      part({ id: "1", part_type: "comment", created_at: conversation.created_at + 100 }),
      part({ id: "2", part_type: "note", created_at: conversation.created_at + 200 }),
      part({ id: "3", part_type: "assignment", created_at: conversation.created_at + 300 }),
    ];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("case_created");
  });

  it("resolves each transition's actor independently from its own part", () => {
    const parts = [
      part({ id: "1", part_type: "snoozed", created_at: conversation.created_at + 100, author: { type: "admin", id: "a1" } }),
      part({ id: "2", part_type: "close", created_at: conversation.created_at + 200, author: { type: "bot", id: "b1" } }),
    ];
    const events = deriveNormalizedEventsForConversation(conversation, parts, "raw_conversation_42");
    expect(events[1]?.actor).toBe("agent");
    expect(events[2]?.actor).toBe("system");
  });
});

describe("deriveCaseClosedAt", () => {
  const closedEvent: DerivedNormalizedEvent = {
    type: "case_closed",
    occurredAt: "2026-01-02T09:00:00Z",
    actor: "agent",
    fromState: "open",
    toState: "resolved",
    sourceRawEventId: "raw_1",
  };
  const createdEvent: DerivedNormalizedEvent = {
    type: "case_created",
    occurredAt: "2026-01-01T09:00:00Z",
    actor: "customer",
    fromState: null,
    toState: "open",
    sourceRawEventId: "raw_conversation_42",
  };

  it("is set from the close transition when the conversation is currently closed", () => {
    const closedAt = deriveCaseClosedAt({ ...conversation, state: "closed" }, [createdEvent, closedEvent]);
    expect(closedAt?.toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });

  it("is null for an open or snoozed conversation", () => {
    expect(deriveCaseClosedAt({ ...conversation, state: "open" }, [createdEvent])).toBeNull();
    expect(deriveCaseClosedAt({ ...conversation, state: "snoozed" }, [createdEvent])).toBeNull();
  });

  it("is null again once a closed conversation is reopened, even though a case_closed event exists in its history", () => {
    const reopened: DerivedNormalizedEvent = {
      type: "state_changed",
      occurredAt: "2026-01-02T15:00:00Z",
      actor: "customer",
      fromState: "resolved",
      toState: "open",
      sourceRawEventId: "raw_2",
    };
    const closedAt = deriveCaseClosedAt({ ...conversation, state: "open" }, [createdEvent, closedEvent, reopened]);
    expect(closedAt).toBeNull();
  });

  it("falls back to the conversation's updated_at when no case_closed event was derived", () => {
    const updatedAtSeconds = 1_700_200_000;
    const closedAt = deriveCaseClosedAt({ ...conversation, state: "closed", updated_at: updatedAtSeconds }, [
      { ...createdEvent, toState: "resolved" },
    ]);
    expect(closedAt?.toISOString()).toBe(new Date(updatedAtSeconds * 1000).toISOString());
  });

  it("uses the most recent case_closed event when the conversation was closed more than once", () => {
    const secondClose: DerivedNormalizedEvent = {
      type: "case_closed",
      occurredAt: "2026-01-04T10:00:00Z",
      actor: "agent",
      fromState: "open",
      toState: "resolved",
      sourceRawEventId: "raw_3",
    };
    const closedAt = deriveCaseClosedAt({ ...conversation, state: "closed" }, [createdEvent, closedEvent, secondClose]);
    expect(closedAt?.toISOString()).toBe("2026-01-04T10:00:00.000Z");
  });
});

describe("normalizeIntercomPriority", () => {
  it("maps Intercom's binary priority onto the policy-matchable vocabulary", () => {
    expect(normalizeIntercomPriority("priority")).toBe("high");
    expect(normalizeIntercomPriority("not_priority")).toBe("normal");
  });

  it("passes through unknown values and nulls", () => {
    expect(normalizeIntercomPriority("urgent")).toBe("urgent");
    expect(normalizeIntercomPriority(null)).toBeNull();
    expect(normalizeIntercomPriority(undefined)).toBeNull();
  });
});

describe("deriveIntercomSubject", () => {
  it("prefers the conversation's own title", () => {
    expect(deriveIntercomSubject({ ...conversation, title: "Login broken" })).toBe("Login broken");
  });

  it("falls back to the ticket title attribute when the title is blank", () => {
    expect(
      deriveIntercomSubject({
        ...conversation,
        title: "",
        ticket: { custom_attributes: { _default_title_: { value: "Cannot export CSV" } } },
      }),
    ).toBe("Cannot export CSV");
  });

  it("falls back to the source subject, else null", () => {
    expect(
      deriveIntercomSubject({ ...conversation, source: { type: "email", subject: "Invoice question" } }),
    ).toBe("Invoice question");
    expect(deriveIntercomSubject(conversation)).toBeNull();
  });

  it("falls back to the opening message's plain text for a chat with no title", () => {
    expect(
      deriveIntercomSubject({
        ...conversation,
        source: { type: "conversation", body: "<p>How do I reset my&nbsp;password?</p>" },
      }),
    ).toBe("How do I reset my password?");
  });

  it("truncates a long opening message", () => {
    const subject = deriveIntercomSubject({
      ...conversation,
      source: { type: "conversation", body: `<p>${"a".repeat(300)}</p>` },
    });
    expect(subject).toHaveLength(120);
    expect(subject?.endsWith("…")).toBe(true);
  });

  it("uses the first customer comment with text when the opening message is empty", () => {
    const parts = [
      part({ id: "p1", part_type: "comment", author: { type: "admin", id: "a" }, body: "<p>Agent reply</p>" }),
      part({ id: "p2", part_type: "comment", author: { type: "user", id: "u" }, body: '<img src="x.png">' }),
      part({ id: "p2b", part_type: "comment", author: { type: "user", id: "u" }, body: "<a href=\"https://x.io/a.png\">https://x.io/a.png</a>" }),
      part({ id: "p3", part_type: "comment", author: { type: "user", id: "u" }, body: "<p>https://x.io/b.gif</p><p>My SMS is broken</p>" }),
    ];
    expect(deriveIntercomSubject({ ...conversation, source: { type: "conversation", body: null } }, parts)).toBe(
      "My SMS is broken",
    );
  });
});
