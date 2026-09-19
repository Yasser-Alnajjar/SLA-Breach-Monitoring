import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "../src/retry";

function response(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe("fetchWithRetry", () => {
  it("returns the response immediately when it isn't retryable", async () => {
    const perform = vi.fn().mockResolvedValue(response(200));
    const result = await fetchWithRetry(perform);
    expect(result.status).toBe(200);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 using Retry-After, then succeeds", async () => {
    const perform = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry(perform, { isRetryableStatus: (r) => r.status === 429 });
    expect(result.status).toBe(200);
    expect(perform).toHaveBeenCalledTimes(2);
  });

  it("retries a 5xx even without an explicit isRetryableStatus predicate", async () => {
    const perform = vi
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry(perform, { baseBackoffMs: 0 });
    expect(result.status).toBe(200);
    expect(perform).toHaveBeenCalledTimes(2);
  });

  it("never retries a status the predicate doesn't flag, even a 403", async () => {
    const perform = vi.fn().mockResolvedValue(response(403));
    const result = await fetchWithRetry(perform, { isRetryableStatus: (r) => r.status === 429 });
    expect(result.status).toBe(403);
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("caps the number of attempts and returns the last response instead of looping forever", async () => {
    const perform = vi.fn().mockResolvedValue(response(429, { "Retry-After": "0" }));
    const result = await fetchWithRetry(perform, {
      isRetryableStatus: (r) => r.status === 429,
      maxAttempts: 3,
    });
    expect(result.status).toBe(429);
    expect(perform).toHaveBeenCalledTimes(3);
  });

  it("falls back to exponential backoff instead of an immediate-retry loop when Retry-After is non-numeric (I-3)", async () => {
    const perform = vi
      .fn()
      .mockResolvedValueOnce(response(429, { "Retry-After": "not-a-number" }))
      .mockResolvedValueOnce(response(200));

    const start = Date.now();
    const result = await fetchWithRetry(perform, { isRetryableStatus: (r) => r.status === 429, baseBackoffMs: 20 });
    expect(result.status).toBe(200);
    // A NaN Retry-After used to become `NaN` ms — effectively an immediate
    // retry loop. It must fall back to the real backoff instead of 0ms.
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("caps total wait time across attempts, not just attempt count", async () => {
    const perform = vi.fn().mockResolvedValue(response(429, { "Retry-After": "1000" }));
    const result = await fetchWithRetry(perform, {
      isRetryableStatus: (r) => r.status === 429,
      maxAttempts: 100,
      maxTotalWaitMs: 50,
    });
    expect(result.status).toBe(429);
    // Retry-After asks for 1000ms per attempt but the total budget is 50ms,
    // so this stops after the first retry rather than running 100 attempts.
    expect(perform).toHaveBeenCalledTimes(2);
  });

  it("retries a thrown network error with the same capped backoff, then succeeds", async () => {
    const perform = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(response(200));

    const result = await fetchWithRetry(perform, { baseBackoffMs: 0 });
    expect(result.status).toBe(200);
    expect(perform).toHaveBeenCalledTimes(2);
  });

  it("rethrows a network error once the attempt budget is exhausted", async () => {
    const perform = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      fetchWithRetry(perform, { maxAttempts: 2, baseBackoffMs: 0 }),
    ).rejects.toThrow("fetch failed");
    expect(perform).toHaveBeenCalledTimes(2);
  });
});
