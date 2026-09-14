import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetAuthThrottleState,
  checkAuthThrottle,
  clearAuthThrottle,
  normalizeLoginIdentity,
  recordFailedAuthAttempt,
} from "../src/lib/auth-throttle";

beforeEach(() => {
  _resetAuthThrottleState();
});

describe("normalizeLoginIdentity", () => {
  it("lowercases the email", () => {
    expect(normalizeLoginIdentity("USER@Example.com")).toBe("user@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeLoginIdentity("  user@example.com  ")).toBe("user@example.com");
  });

  it("trims and lowercases together", () => {
    expect(normalizeLoginIdentity("  USER@Example.com\n")).toBe("user@example.com");
  });
});

describe("checkAuthThrottle / recordFailedAuthAttempt — progressive delay policy", () => {
  it("never throttles an identity that has no recorded failures", () => {
    expect(checkAuthThrottle("user@example.com").throttled).toBe(false);
  });

  it("the first 3 failed attempts do not throttle the next attempt", () => {
    const now = 1_000_000;
    const identity = "user@example.com";

    recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(false);

    recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(false);

    recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(false);
  });

  it("applies the documented progressive delay at each failure-count threshold", () => {
    const identity = "user@example.com";
    const now = 1_000_000;
    const expectedDelaysByFailureCount: Record<number, number> = {
      4: 2,
      5: 5,
      6: 10,
      7: 20,
      8: 30,
      9: 60,
      10: 60,
    };

    let failures = 0;
    for (const [countStr, expectedDelay] of Object.entries(expectedDelaysByFailureCount)) {
      const targetCount = Number(countStr);
      while (failures < targetCount) {
        recordFailedAuthAttempt(identity, now);
        failures += 1;
      }
      const status = checkAuthThrottle(identity, now);
      expect(status.throttled).toBe(true);
      expect(status.retryAfterSeconds).toBe(expectedDelay);
    }
  });

  it("stops throttling once the cooldown window has elapsed", () => {
    const identity = "user@example.com";
    const now = 1_000_000;

    for (let i = 0; i < 4; i += 1) recordFailedAuthAttempt(identity, now);
    const status = checkAuthThrottle(identity, now);
    expect(status.throttled).toBe(true);

    const after = now + (status.retryAfterSeconds ?? 0) * 1000;
    expect(checkAuthThrottle(identity, after).throttled).toBe(false);
  });

  it("a successful login (clearAuthThrottle) resets the failed-attempt state", () => {
    const identity = "user@example.com";
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(true);

    clearAuthThrottle(identity);
    expect(checkAuthThrottle(identity, now).throttled).toBe(false);

    // The cleared identity starts fresh — back to the "first 3 are free" policy.
    recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(false);
  });

  it("failed state expires after a period of inactivity", () => {
    const identity = "user@example.com";
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) recordFailedAuthAttempt(identity, now);
    expect(checkAuthThrottle(identity, now).throttled).toBe(true);

    // Long after both the cooldown and the idle-reset window have elapsed.
    const muchLater = now + 60 * 60_000;
    expect(checkAuthThrottle(identity, muchLater).throttled).toBe(false);

    // The record should have been forgotten, not just its cooldown expired —
    // the very next failure is treated as failure #1, not #6.
    recordFailedAuthAttempt(identity, muchLater);
    recordFailedAuthAttempt(identity, muchLater);
    recordFailedAuthAttempt(identity, muchLater);
    expect(checkAuthThrottle(identity, muchLater).throttled).toBe(false);
  });

  it("tracks distinct normalized identities independently", () => {
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) recordFailedAuthAttempt("victim@example.com", now);
    expect(checkAuthThrottle("victim@example.com", now).throttled).toBe(true);
    expect(checkAuthThrottle("someone-else@example.com", now).throttled).toBe(false);
  });

  it("treats differently-cased/whitespace-padded emails as the same identity once normalized", () => {
    const now = 1_000_000;
    const canonical = normalizeLoginIdentity("  User@Example.com ");

    for (let i = 0; i < 5; i += 1) {
      recordFailedAuthAttempt(normalizeLoginIdentity("User@Example.com"), now);
    }

    expect(checkAuthThrottle(canonical, now).throttled).toBe(true);
  });
});
