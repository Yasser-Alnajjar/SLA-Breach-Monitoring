/**
 * `authOptions.callbacks.jwt` (roadmap 5.7): proves the wiring between
 * this callback and `assertSessionStillValid` — that the DB re-check only
 * runs on a *subsequent* call (no `user`, i.e. not the initial sign-in),
 * and that its rejection actually propagates out of the callback (the
 * signal NextAuth's own `session()` route handler turns into a cleared
 * session — see `@/lib/auth.ts`'s `authOptions` doc comment). The
 * re-check's own pass/fail logic is covered directly in
 * `session-validity.test.ts`; this file only covers the wiring.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionValidity = vi.hoisted(() => ({ assertSessionStillValid: vi.fn(async () => {}) }));

vi.mock("@sla/db", () => ({ getPrismaClient: vi.fn(() => ({})) }));
vi.mock("@/lib/session-validity", () => ({
  assertSessionStillValid: sessionValidity.assertSessionStillValid,
  SessionInvalidatedError: class SessionInvalidatedError extends Error {},
}));

beforeEach(() => {
  vi.resetModules();
  sessionValidity.assertSessionStillValid.mockReset();
  sessionValidity.assertSessionStillValid.mockResolvedValue(undefined);
});

async function getJwtCallback() {
  const { authOptions } = await import("../src/lib/auth");
  return authOptions.callbacks!.jwt!;
}

describe("authOptions.callbacks.jwt", () => {
  it("does not re-validate against the database on the initial sign-in (user present)", async () => {
    const jwt = await getJwtCallback();
    await jwt({
      token: { userId: "u1", organizationId: "org-1", role: "owner", sessionVersion: 0 },
      user: {
        id: "u1",
        organizationId: "org-1",
        role: "owner",
        sessionVersion: 0,
        email: "a@x.com",
        emailVerifiedAt: null,
        name: null,
        image: null,
        createdAt: new Date(),
      },
    } as never);

    expect(sessionValidity.assertSessionStillValid).not.toHaveBeenCalled();
  });

  it("re-validates against the database on a subsequent call (no user)", async () => {
    const jwt = await getJwtCallback();
    const token = { userId: "u1", organizationId: "org-1", role: "owner", sessionVersion: 2 };
    await jwt({ token, user: undefined } as never);

    expect(sessionValidity.assertSessionStillValid).toHaveBeenCalledWith(expect.anything(), token);
  });

  it("propagates a rejection from assertSessionStillValid (a stale token) out of the callback", async () => {
    sessionValidity.assertSessionStillValid.mockRejectedValue(new Error("Session invalidated"));
    const jwt = await getJwtCallback();
    const token = { userId: "u1", organizationId: "org-1", role: "owner", sessionVersion: 2 };

    await expect(jwt({ token, user: undefined } as never)).rejects.toThrow("Session invalidated");
  });
});
