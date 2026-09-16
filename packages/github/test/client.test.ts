import { afterEach, describe, expect, it, vi } from "vitest";
import { GithubApiError, GithubClient, GithubPermissionDeniedError } from "../src/client";
import type { GithubCredentials } from "../src/types";

const baseCredentials: GithubCredentials = {
  accessToken: "stale-token",
  tokenType: "bearer",
  scope: "repo",
  owner: "acme",
  repo: "widgets",
};

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

const emptySearchPage = { data: { search: { nodes: [], pageInfo: { hasNextPage: false } } } };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GithubClient 401 handling", () => {
  it("refreshes once and retries the request on a single 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: "Bad credentials" }))
      .mockResolvedValueOnce(jsonResponse(200, emptySearchPage));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn().mockResolvedValue({ ...baseCredentials, accessToken: "fresh-token" });
    const client = new GithubClient(baseCredentials, { onUnauthorized });

    const result = await client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z");

    expect(result).toEqual({ nodes: [], pageInfo: { hasNextPage: false } });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledWith(baseCredentials);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    });
  });

  it("does not retry indefinitely when the refreshed token also gets a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: "Bad credentials" }));
    vi.stubGlobal("fetch", fetchMock);

    const onUnauthorized = vi.fn().mockResolvedValue({ ...baseCredentials, accessToken: "fresh-token" });
    const client = new GithubClient(baseCredentials, { onUnauthorized });

    await expect(
      client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z"),
    ).rejects.toBeInstanceOf(GithubApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("GithubClient rate-limit handling", () => {
  it("waits out a 403 with a Retry-After header and retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(403, { message: "secondary rate limit" }, { "Retry-After": "1" }))
      .mockResolvedValueOnce(jsonResponse(200, emptySearchPage));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GithubClient(baseCredentials);
    const promise = client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z");

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ nodes: [], pageInfo: { hasNextPage: false } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry a plain 403 with no Retry-After header — it's lost access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { message: "Resource not accessible" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GithubClient(baseCredentials);

    const error = await client
      .searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubPermissionDeniedError);
    expect(error).toBeInstanceOf(GithubApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 403 with x-ratelimit-remaining: 0 as rate-limit exhaustion, not lost access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, { message: "Forbidden" }, { "x-ratelimit-remaining": "0" }),
      ),
    );
    const client = new GithubClient(baseCredentials);

    const error = await client
      .searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).not.toBeInstanceOf(GithubPermissionDeniedError);
  });

  it("treats a secondary-rate-limit 403 identified only by its message as rate limiting, not lost access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, { message: "You have exceeded a secondary rate limit. Please wait a few minutes." }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new GithubClient(baseCredentials);

    const error = await client
      .searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).not.toBeInstanceOf(GithubPermissionDeniedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never calls onUnauthorized for a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { message: "Resource not accessible" })));
    const onUnauthorized = vi.fn();
    const client = new GithubClient(baseCredentials, { onUnauthorized });

    await expect(
      client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z"),
    ).rejects.toBeInstanceOf(GithubPermissionDeniedError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("GithubClient GraphQL error handling", () => {
  it("throws GithubApiError when the response carries a top-level errors array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ message: "Something went wrong" }] })),
    );
    const client = new GithubClient(baseCredentials);

    const error = await client
      .searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).not.toBeInstanceOf(GithubPermissionDeniedError);
  });

  it("keeps a RATE_LIMITED GraphQL error as a plain GithubApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ type: "RATE_LIMITED", message: "rate limited" }] })),
    );
    const client = new GithubClient(baseCredentials);

    const error = await client
      .searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).not.toBeInstanceOf(GithubPermissionDeniedError);
  });

  it.each(["FORBIDDEN", "INSUFFICIENT_SCOPES"])(
    "throws GithubPermissionDeniedError for a %s GraphQL error returned with HTTP 200",
    async (type) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse(200, { data: null, errors: [{ type, message: "denied" }] })),
      );
      const client = new GithubClient(baseCredentials);

      await expect(
        client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z"),
      ).rejects.toBeInstanceOf(GithubPermissionDeniedError);
    },
  );
});

describe("GithubClient search filtering", () => {
  it("builds a repo-scoped, date-windowed search query and filters non-PullRequest nodes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          search: {
            nodes: [
              {},
              {
                id: "pr-1",
                number: 42,
                title: "Fix thing",
                url: "https://github.com/acme/widgets/pull/42",
                state: "OPEN",
                merged: false,
                headRefName: "fix-thing",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                mergedAt: null,
                closedAt: null,
                author: { login: "octocat" },
              },
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GithubClient(baseCredentials);
    const result = await client.searchPullRequests("acme", "widgets", "2026-01-01T00:00:00.000Z");

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.number).toBe(42);

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      variables: { query: string };
    };
    expect(body.variables.query).toBe("repo:acme/widgets is:pr updated:>=2026-01-01");
  });
});

describe("GithubClient empty sub-connections", () => {
  it("returns an empty connection when a timeline query resolves no node", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { node: null } })));
    const client = new GithubClient(baseCredentials);

    const result = await client.fetchTimelineItems("pr-1");

    expect(result).toEqual({ nodes: [], pageInfo: { hasNextPage: false } });
  });
});

describe("GithubClient.verifyRepositoryAccess", () => {
  it("resolves when the repository is readable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { repository: { id: "R_1" } } })));

    await expect(new GithubClient(baseCredentials).verifyRepositoryAccess("acme", "widgets")).resolves.toBeUndefined();
  });

  it("treats NOT_FOUND (App not installed, no access, or a typo) as permission denied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { repository: null },
          errors: [{ type: "NOT_FOUND", path: ["repository"], message: "Could not resolve to a Repository" }],
        }),
      ),
    );

    await expect(
      new GithubClient(baseCredentials).verifyRepositoryAccess("acme", "widgets"),
    ).rejects.toBeInstanceOf(GithubPermissionDeniedError);
  });

  it("leaves other GraphQL errors as a plain GithubApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { errors: [{ type: "SOMETHING_ELSE", message: "boom" }] })),
    );

    const error = await new GithubClient(baseCredentials)
      .verifyRepositoryAccess("acme", "widgets")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).not.toBeInstanceOf(GithubPermissionDeniedError);
  });
});
