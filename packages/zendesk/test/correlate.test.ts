import { describe, expect, it } from "vitest";
import { parseJiraLinkRecord } from "../src/correlate";
import type { ZendeskJiraLink } from "../src/types";

describe("parseJiraLinkRecord", () => {
  // Live-shape regression: a real connected account's GET /api/v2/jira/links
  // response for a real ticket returned `ticket_id: "13"` (a string) — not a
  // number as the field name suggests. This is the exact record (redacted
  // ids aside) that silently failed correlation before this fix.
  it("extracts the ticket id and issue key from a real, well-formed record (ticket_id as a string)", () => {
    const link: ZendeskJiraLink = { id: 81003289, ticket_id: "13", issue_id: "10745", issue_key: "KAN-42" };
    expect(parseJiraLinkRecord(link)).toEqual({ ticketId: "13", issueKey: "KAN-42" });
  });

  it("also accepts ticket_id as an actual number, defensively", () => {
    const link = { id: 1, ticket_id: 123, issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toEqual({ ticketId: "123", issueKey: "KAN-38" });
  });

  it("trims incidental whitespace around a string ticket_id", () => {
    const link = { id: 1, ticket_id: " 123 ", issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toEqual({ ticketId: "123", issueKey: "KAN-38" });
  });

  it("returns null when ticket_id is missing", () => {
    const link = { id: 1, issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });

  it("returns null when ticket_id is a non-numeric string", () => {
    const link = { id: 1, ticket_id: "not-a-ticket-id", issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });

  it("returns null when ticket_id is a blank string", () => {
    const link = { id: 1, ticket_id: "   ", issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });

  it("returns null when ticket_id is neither a string nor a number", () => {
    const link = { id: 1, ticket_id: null, issue_key: "KAN-38" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });

  it("returns null when issue_key is missing", () => {
    const link = { id: 1, ticket_id: "123" } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });

  it("returns null when issue_key is an empty or blank string", () => {
    expect(parseJiraLinkRecord({ id: 1, ticket_id: "123", issue_key: "" })).toBeNull();
    expect(parseJiraLinkRecord({ id: 1, ticket_id: "123", issue_key: "   " })).toBeNull();
  });

  it("returns null when issue_key is not a string", () => {
    const link = { id: 1, ticket_id: "123", issue_key: 38 } as unknown as ZendeskJiraLink;
    expect(parseJiraLinkRecord(link)).toBeNull();
  });
});
