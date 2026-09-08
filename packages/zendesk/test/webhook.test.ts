import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractZendeskWebhookTicketId,
  generateWebhookSecret,
  runZendeskWebhookIngest,
  verifyZendeskWebhookSecret,
} from "../src/webhook";
import type { ZendeskCredentials, ZendeskCursor, ZendeskTicket } from "../src/types";

const config = { clientId: "client-123", clientSecret: "secret-xyz", redirectUri: "https://app.example.com/cb" };

const credentials: ZendeskCredentials = {
  subdomain: "acme",
  accessToken: "token-abc",
  tokenType: "bearer",
  scope: "read",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function ticket(id: number): ZendeskTicket {
  return {
    id,
    url: `https://acme.zendesk.com/api/v2/tickets/${id}.json`,
    external_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    status: "open",
    priority: null,
    organization_id: null,
  };
}

function createFakePrisma(cursor: ZendeskCursor | null = null) {
  const row: { credentials: ZendeskCredentials; cursor: ZendeskCursor | null } = {
    credentials: structuredClone(credentials),
    cursor,
  };
  const rawEvents: { integrationId: string; providerEventId: string }[] = [];
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => structuredClone(row)),
      update: vi.fn(async () => {
        throw new Error("runZendeskWebhookIngest must never touch Integration.cursor");
      }),
    },
    rawEvent: {
      createMany: vi.fn(async ({ data }: { data: { integrationId: string; providerEventId: string }[] }) => {
        rawEvents.push(...data);
        return { count: data.length };
      }),
    },
    _rawEvents: rawEvents,
  } as const;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateWebhookSecret", () => {
  it("produces distinct, non-trivial secrets", () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});

describe("verifyZendeskWebhookSecret", () => {
  const secret = "bearer-token-abc123";

  it("accepts a matching bearer token", () => {
    expect(verifyZendeskWebhookSecret(secret, `Bearer ${secret}`)).toBe(true);
  });

  it("rejects a mismatched bearer token", () => {
    expect(verifyZendeskWebhookSecret(secret, "Bearer wrong-token")).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(verifyZendeskWebhookSecret(secret, null)).toBe(false);
  });

  it("rejects a header that isn't in Bearer form", () => {
    expect(verifyZendeskWebhookSecret(secret, secret)).toBe(false);
    expect(verifyZendeskWebhookSecret(secret, `Basic ${secret}`)).toBe(false);
  });

  it("rejects a token of a different length without throwing", () => {
    expect(verifyZendeskWebhookSecret(secret, `Bearer ${secret}extra`)).toBe(false);
  });
});

describe("extractZendeskWebhookTicketId", () => {
  it("reads the documented custom-trigger shape", () => {
    expect(extractZendeskWebhookTicketId({ ticket_id: "42" })).toBe(42);
  });

  it("reads a native ticket-events envelope's detail.id", () => {
    expect(extractZendeskWebhookTicketId({ detail: { id: 42 } })).toBe(42);
  });

  it("reads a nested ticket.id shape", () => {
    expect(extractZendeskWebhookTicketId({ ticket: { id: 42 } })).toBe(42);
  });

  it("returns null for a payload with no recognizable ticket id", () => {
    expect(extractZendeskWebhookTicketId({ foo: "bar" })).toBeNull();
    expect(extractZendeskWebhookTicketId(null)).toBeNull();
    expect(extractZendeskWebhookTicketId("not an object")).toBeNull();
  });
});

describe("runZendeskWebhookIngest", () => {
  it("fetches the ticket and all of its audit pages, and writes RawEvents without touching the cursor", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/v2/tickets/42.json")) {
        return jsonResponse(200, { ticket: ticket(42) });
      }
      if (url === "https://acme.zendesk.com/api/v2/tickets/42/audits.json") {
        return jsonResponse(200, {
          audits: [{ id: 1, ticket_id: 42, created_at: "2026-01-01T00:00:00Z", author_id: 1, events: [] }],
          next_page: "https://acme.zendesk.com/api/v2/tickets/42/audits.json?page=2",
        });
      }
      if (url.includes("page=2")) {
        return jsonResponse(200, {
          audits: [{ id: 2, ticket_id: 42, created_at: "2026-01-01T00:05:00Z", author_id: 1, events: [] }],
          next_page: null,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const prisma = createFakePrisma();
    const result = await runZendeskWebhookIngest(prisma as never, "integration-1", config, 42);

    expect(result).toEqual({ ticketsFetched: 1, ticketAuditsFetched: 2 });
    expect(prisma._rawEvents).toHaveLength(3);
    expect(prisma._rawEvents.map((e) => e.providerEventId)).toEqual(
      expect.arrayContaining([expect.stringContaining("ticket:42:"), "ticket_audit:1", "ticket_audit:2"]),
    );
    expect(prisma.integration.update).not.toHaveBeenCalled();
  });
});
