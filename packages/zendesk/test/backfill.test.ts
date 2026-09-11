import { afterEach, describe, expect, it, vi } from "vitest";
import { runZendeskBackfill } from "../src/backfill";
import type { ZendeskCredentials, ZendeskCursor, ZendeskTicket } from "../src/types";

const config = { clientId: "client-123", clientSecret: "secret-xyz", redirectUri: "https://app.example.com/cb" };

const credentials: ZendeskCredentials = {
  subdomain: "acme",
  accessToken: "token-abc",
  tokenType: "bearer",
  scope: "read",
};

function createFakePrisma(cursor: ZendeskCursor | null = null) {
  let row: { credentials: ZendeskCredentials; cursor: ZendeskCursor | null } = {
    credentials: structuredClone(credentials),
    cursor,
  };
  const rawEvents: unknown[] = [];
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => structuredClone(row)),
      update: vi.fn(async ({ data }: { data: { cursor: ZendeskCursor } }) => {
        row = { ...row, cursor: data.cursor };
        return structuredClone(row);
      }),
    },
    rawEvent: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => {
        rawEvents.push(...data);
        return { count: data.length };
      }),
    },
    _rawEvents: rawEvents,
  } as const;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function ticket(id: number): ZendeskTicket {
  return {
    id,
    url: `https://acme.zendesk.com/api/v2/tickets/${id}.json`,
    external_id: null,
    subject: "Cannot log in to account",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    status: "open",
    priority: null,
    organization_id: null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runZendeskBackfill", () => {
  it("skips a ticket whose audits return 404 instead of aborting the whole run", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/v2/incremental/tickets.json")) {
        return jsonResponse(200, { tickets: [ticket(1), ticket(2)], end_time: 1000, next_page: null, count: 2 });
      }
      if (url.includes("/api/v2/tickets/1/audits.json")) {
        return jsonResponse(404, { error: "RecordNotFound" });
      }
      if (url.includes("/api/v2/tickets/2/audits.json")) {
        return jsonResponse(200, {
          audits: [{ id: 900, ticket_id: 2, created_at: "2026-01-01T00:00:00Z", author_id: 1, events: [] }],
          next_page: null,
        });
      }
      if (url.includes("/api/v2/incremental/organizations.json")) {
        return jsonResponse(200, { organizations: [], end_time: 1000, next_page: null, count: 0 });
      }
      if (url.includes("/api/v2/slas/policies.json")) {
        return jsonResponse(200, { sla_policies: [], next_page: null });
      }
      if (url.includes("/api/v2/business_hours/schedules.json")) {
        return jsonResponse(200, { schedules: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const prisma = createFakePrisma();
    const result = await runZendeskBackfill(prisma as never, "integration-1", config);

    expect(result.ticketsFetched).toBe(2);
    expect(result.ticketAuditsFetched).toBe(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("ticket 1"));
  });
});
