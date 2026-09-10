import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractJiraWebhookIssueKey,
  generateWebhookSecret,
  runJiraWebhookIngest,
  shouldIngestJiraWebhookEvent,
  verifyJiraWebhookSecret,
} from "../src/webhook";
import type { JiraCredentials, JiraIssue } from "../src/types";

const config = { clientId: "client-123", clientSecret: "secret-xyz", redirectUri: "https://app.example.com/cb" };

const credentials: JiraCredentials = {
  cloudId: "cloud-1",
  siteUrl: "https://acme.atlassian.net",
  accessToken: "token-abc",
  tokenType: "bearer",
  scope: "read:jira-work",
};

function issue(key: string): JiraIssue {
  return {
    id: "1001",
    key,
    self: `https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/${key}`,
    fields: {
      summary: "Something broke",
      status: { id: "1", name: "To Do" },
      priority: null,
      project: { id: "10", key: "ENG", name: "Engineering" },
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      reporter: null,
      assignee: null,
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function createFakePrisma() {
  const row = { credentials: structuredClone(credentials), cursor: null as unknown };
  const rawEvents: { integrationId: string; providerEventId: string }[] = [];
  return {
    integration: {
      findUniqueOrThrow: vi.fn(async () => structuredClone(row)),
      update: vi.fn(async () => {
        throw new Error("runJiraWebhookIngest must never touch Integration.cursor");
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

describe("verifyJiraWebhookSecret", () => {
  it("accepts a matching secret", () => {
    expect(verifyJiraWebhookSecret("abc123", "abc123")).toBe(true);
  });

  it("rejects a mismatched secret", () => {
    expect(verifyJiraWebhookSecret("abc123", "wrong")).toBe(false);
  });

  it("rejects a missing secret", () => {
    expect(verifyJiraWebhookSecret("abc123", null)).toBe(false);
  });

  it("rejects a secret of a different length without throwing", () => {
    expect(verifyJiraWebhookSecret("abc123", "abc1234")).toBe(false);
  });
});

describe("shouldIngestJiraWebhookEvent", () => {
  it("ingests issue created/updated events", () => {
    expect(shouldIngestJiraWebhookEvent({ webhookEvent: "jira:issue_created" })).toBe(true);
    expect(shouldIngestJiraWebhookEvent({ webhookEvent: "jira:issue_updated" })).toBe(true);
  });

  it("ignores deletions and unrecognized events", () => {
    expect(shouldIngestJiraWebhookEvent({ webhookEvent: "jira:issue_deleted" })).toBe(false);
    expect(shouldIngestJiraWebhookEvent({ webhookEvent: "comment_created" })).toBe(false);
    expect(shouldIngestJiraWebhookEvent({})).toBe(false);
  });
});

describe("extractJiraWebhookIssueKey", () => {
  it("reads the issue key from the payload", () => {
    expect(extractJiraWebhookIssueKey({ issue: { key: "ENG-42" } })).toBe("ENG-42");
  });

  it("returns null when no issue key is present", () => {
    expect(extractJiraWebhookIssueKey({})).toBeNull();
    expect(extractJiraWebhookIssueKey({ issue: {} })).toBeNull();
  });
});

describe("runJiraWebhookIngest", () => {
  it("fetches the issue, its full changelog, and remote links, without touching the cursor", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/rest/api/3/status")) {
        return jsonResponse(200, [
          { id: "1", name: "To Do", statusCategory: { key: "new" } },
          { id: "2", name: "In Review", statusCategory: { key: "indeterminate" } },
        ]);
      }
      if (url.includes("/rest/api/3/issue/ENG-42?")) {
        return jsonResponse(200, issue("ENG-42"));
      }
      if (url.includes("/changelog?startAt=0")) {
        return jsonResponse(200, {
          values: [{ id: "h1", author: null, created: "2026-01-01T00:00:00Z", items: [] }],
          startAt: 0,
          maxResults: 100,
          total: 2,
          isLast: false,
        });
      }
      if (url.includes("/changelog?startAt=1")) {
        return jsonResponse(200, {
          values: [{ id: "h2", author: null, created: "2026-01-01T00:05:00Z", items: [] }],
          startAt: 1,
          maxResults: 100,
          total: 2,
          isLast: true,
        });
      }
      if (url.includes("/remotelink")) {
        return jsonResponse(200, [{ id: 1, self: "self-url", object: { url: "https://acme.zendesk.com/agent/tickets/9", title: "t" } }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const prisma = createFakePrisma();
    const result = await runJiraWebhookIngest(prisma as never, "integration-1", config, "ENG-42");

    expect(result).toEqual({
      issuesFetched: 1,
      changelogHistoriesFetched: 2,
      remoteLinksFetched: 1,
      statusesFetched: 2,
    });
    expect(prisma._rawEvents).toHaveLength(6);
    expect(prisma._rawEvents.map((e) => e.providerEventId)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("status:1:"),
        expect.stringContaining("status:2:"),
        expect.stringContaining("issue:ENG-42:"),
        "issue_changelog:ENG-42:h1",
        "issue_changelog:ENG-42:h2",
        expect.stringContaining("remote_link:ENG-42:1:"),
      ]),
    );
    expect(prisma.integration.update).not.toHaveBeenCalled();
  });
});
