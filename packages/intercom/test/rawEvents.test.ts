import { describe, expect, it } from "vitest";
import {
  mapCompanyToRawEvent,
  mapContactToRawEvent,
  mapConversationPartToRawEvent,
  mapConversationToRawEvent,
} from "../src/rawEvents";
import type { IntercomCompany, IntercomContact, IntercomConversation, IntercomConversationPart } from "../src/types";

describe("mapConversationToRawEvent", () => {
  it("folds the content hash into the provider event id", () => {
    const conversation: IntercomConversation = { id: "42", created_at: 1, updated_at: 1, state: "open" };
    const event = mapConversationToRawEvent(conversation);
    expect(event.providerEventId).toBe(`conversation:42:${event.sourceHash}`);
    expect(event.payload).toBe(conversation);
  });

  it("produces a different provider event id when the conversation changes", () => {
    const a = mapConversationToRawEvent({ id: "42", created_at: 1, updated_at: 1, state: "open" });
    const b = mapConversationToRawEvent({ id: "42", created_at: 1, updated_at: 1, state: "closed" });
    expect(a.providerEventId).not.toBe(b.providerEventId);
  });
});

describe("mapConversationPartToRawEvent", () => {
  it("uses the bare part id with no hash suffix — parts are an immutable log", () => {
    const part: IntercomConversationPart = { id: "part-1", part_type: "close", created_at: 1 };
    const event = mapConversationPartToRawEvent("42", part);
    expect(event.providerEventId).toBe("conversation_part:42:part-1");
  });
});

describe("mapCompanyToRawEvent", () => {
  it("folds the content hash into the provider event id", () => {
    const company: IntercomCompany = { id: "co-1", name: "Acme", updated_at: 1 };
    const event = mapCompanyToRawEvent(company);
    expect(event.providerEventId).toBe(`company:co-1:${event.sourceHash}`);
  });
});

describe("mapContactToRawEvent", () => {
  it("folds the content hash into the provider event id", () => {
    const contact: IntercomContact = { id: "contact-1" };
    const event = mapContactToRawEvent(contact);
    expect(event.providerEventId).toBe(`contact:contact-1:${event.sourceHash}`);
  });
});
