import { describe, expect, it } from "vitest";
import {
  mapAuditToRawEvent,
  mapOrganizationToRawEvent,
  mapSlaPolicyToRawEvent,
  mapTicketToRawEvent,
} from "../src/rawEvents";
import type { ZendeskAudit, ZendeskOrganization, ZendeskSlaPolicy, ZendeskTicket } from "../src/types";

const ticket: ZendeskTicket = {
  id: 42,
  url: "https://acme.zendesk.com/api/v2/tickets/42.json",
  external_id: null,
  subject: "Cannot log in to account",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  status: "open",
  priority: "high",
  organization_id: 7,
};

describe("mapAuditToRawEvent", () => {
  it("keys by audit id alone — audits are immutable, never re-hashed", () => {
    const audit: ZendeskAudit = { id: 100, ticket_id: 42, created_at: "2026-01-01T00:00:00Z", author_id: 1, events: [] };
    const result = mapAuditToRawEvent(audit);
    expect(result.providerEventId).toBe("ticket_audit:100");
    expect(result.payload).toBe(audit);
  });
});

describe("mapTicketToRawEvent", () => {
  it("folds the content hash into the provider event id", () => {
    const result = mapTicketToRawEvent(ticket);
    expect(result.providerEventId).toBe(`ticket:42:${result.sourceHash}`);
  });

  it("produces a different provider event id when the ticket changes", () => {
    const before = mapTicketToRawEvent(ticket);
    const after = mapTicketToRawEvent({ ...ticket, status: "pending" });
    expect(after.providerEventId).not.toBe(before.providerEventId);
  });

  it("produces the same provider event id for an unchanged re-fetch", () => {
    const first = mapTicketToRawEvent(ticket);
    const second = mapTicketToRawEvent({ ...ticket });
    expect(second.providerEventId).toBe(first.providerEventId);
  });
});

describe("mapOrganizationToRawEvent", () => {
  it("keys by id and content hash", () => {
    const org: ZendeskOrganization = { id: 7, name: "Acme", updated_at: "2026-01-01T00:00:00Z" };
    const result = mapOrganizationToRawEvent(org);
    expect(result.providerEventId).toBe(`organization:7:${result.sourceHash}`);
  });
});

describe("mapSlaPolicyToRawEvent", () => {
  it("keys by id and content hash", () => {
    const policy: ZendeskSlaPolicy = { id: 3, title: "P1" };
    const result = mapSlaPolicyToRawEvent(policy);
    expect(result.providerEventId).toBe(`sla_policy:3:${result.sourceHash}`);
  });
});
