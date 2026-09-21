import { describe, expect, it } from "vitest";
import {
  mapAuditToRawEvent,
  mapJiraLinkManifestToRawEvent,
  mapJiraLinkToRawEvent,
  mapOrganizationToRawEvent,
  mapSlaPolicyToRawEvent,
  mapTicketToRawEvent,
  mapUserToRawEvent,
} from "../src/rawEvents";
import type { ZendeskAudit, ZendeskJiraLink, ZendeskOrganization, ZendeskSlaPolicy, ZendeskTicket } from "../src/types";

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

describe("mapUserToRawEvent", () => {
  it("keeps only id and role, keyed by a hash that changes only when the role does", () => {
    const agent = { id: 7, role: "agent" as const, name: "Agent A", email: "a@example.com" };
    const result = mapUserToRawEvent(agent);
    expect(result.payload).toEqual({ id: 7, role: "agent" });
    expect(result.providerEventId).toBe(`user:7:${result.sourceHash}`);
    expect(mapUserToRawEvent({ ...agent, name: "Renamed" }).providerEventId).toBe(result.providerEventId);
    expect(mapUserToRawEvent({ ...agent, role: "end-user" }).providerEventId).not.toBe(result.providerEventId);
  });
});

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

  it("resolves requester_name and assignee_name from the users sideload (D10/3.6)", () => {
    const users = [
      { id: 501, role: "end-user" as const, name: "Rae Requester" },
      { id: 900, role: "agent" as const, name: "Ada Agent" },
    ];
    const result = mapTicketToRawEvent(
      { ...ticket, requester_id: 501, assignee_id: 900 },
      users,
    );
    expect(result.payload).toMatchObject({ requester_name: "Rae Requester", assignee_name: "Ada Agent" });
  });

  it("resolves to null when the requester/assignee is missing or not in the sideload", () => {
    const result = mapTicketToRawEvent({ ...ticket, requester_id: 501, assignee_id: null }, []);
    expect(result.payload).toMatchObject({ requester_name: null, assignee_name: null });
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

describe("mapJiraLinkToRawEvent", () => {
  // ticket_id is a string in the live API ("13", not 13) — see ZendeskJiraLink's doc comment.
  it("keys by the link's own id and content hash", () => {
    const link: ZendeskJiraLink = { id: 82931, ticket_id: "123", issue_key: "KAN-38" };
    const result = mapJiraLinkToRawEvent(link);
    expect(result.providerEventId).toBe(`jira_link:82931:${result.sourceHash}`);
    expect(result.payload).toBe(link);
  });

  it("produces a different provider event id when the link changes", () => {
    const link: ZendeskJiraLink = { id: 1, ticket_id: "123", issue_key: "KAN-38" };
    const before = mapJiraLinkToRawEvent(link);
    const after = mapJiraLinkToRawEvent({ ...link, issue_key: "KAN-39" });
    expect(after.providerEventId).not.toBe(before.providerEventId);
  });

  it("produces the same provider event id for an unchanged re-fetch", () => {
    const link: ZendeskJiraLink = { id: 1, ticket_id: "123", issue_key: "KAN-38" };
    const first = mapJiraLinkToRawEvent(link);
    const second = mapJiraLinkToRawEvent({ ...link });
    expect(second.providerEventId).toBe(first.providerEventId);
  });
});

describe("mapJiraLinkManifestToRawEvent", () => {
  it("sorts the link ids so field order never changes the content hash", () => {
    const a = mapJiraLinkManifestToRawEvent([3, 1, 2]);
    const b = mapJiraLinkManifestToRawEvent([1, 2, 3]);
    expect(a.sourceHash).toBe(b.sourceHash);
    expect(a.payload).toEqual({ linkIds: [1, 2, 3] });
  });

  // Unlike every other manifest/snapshot mapper in this file, this one must
  // NOT dedupe identical content onto the same provider event id: a link set
  // can legitimately oscillate back to one it held before (unlink, then
  // re-link the same issue), and the correlator picks the *latest* manifest
  // by `fetchedAt` to decide what's currently linked — collapsing a
  // reaffirming write onto the original row's old id (and so its old
  // `fetchedAt`, since `skipDuplicates` no-ops) would make the correlator
  // read a stale manifest as the latest one. This was a real regression
  // caught by a DB-level "unlink then re-link the same issue" test.
  it("produces a distinct provider event id even for identical content on repeated calls", () => {
    const first = mapJiraLinkManifestToRawEvent([1]);
    const second = mapJiraLinkManifestToRawEvent([1]);
    expect(second.providerEventId).not.toBe(first.providerEventId);
    expect(second.sourceHash).toBe(first.sourceHash); // content hash itself is still stable
  });
});
