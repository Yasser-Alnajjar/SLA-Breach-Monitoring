/**
 * `POST /api/email-verification/confirm` (roadmap 5.6): the public
 * token-consumption endpoint — no session, the token is the credential.
 * Pattern A, fully mocked (`@sla/db`'s `verifyEmail`). Error classes kept
 * real via `importActual` so the route's own `instanceof` branches are
 * genuinely exercised.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ verifyEmail: vi.fn() }));

vi.mock("@sla/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sla/db")>();
  return {
    ...actual,
    getPrismaClient: vi.fn(() => ({})),
    verifyEmail: db.verifyEmail,
  };
});

beforeEach(() => {
  vi.resetModules();
  db.verifyEmail.mockReset();
});

function postRequest(body: unknown) {
  return new Request("http://localhost/api/email-verification/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/email-verification/confirm", () => {
  it("returns 400 for a missing token, without calling verifyEmail", async () => {
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
    expect(db.verifyEmail).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown token", async () => {
    const { EmailVerificationTokenNotFoundError } = await import("@sla/db");
    db.verifyEmail.mockRejectedValue(new EmailVerificationTokenNotFoundError());
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({ token: "t" }));
    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired token", async () => {
    const { EmailVerificationTokenExpiredError } = await import("@sla/db");
    db.verifyEmail.mockRejectedValue(new EmailVerificationTokenExpiredError());
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({ token: "t" }));
    expect(response.status).toBe(410);
  });

  it("returns 410 for an already-used token", async () => {
    const { EmailVerificationTokenUsedError } = await import("@sla/db");
    db.verifyEmail.mockRejectedValue(new EmailVerificationTokenUsedError());
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({ token: "t" }));
    expect(response.status).toBe(410);
  });

  it("returns 409 when the target email was registered by someone else before confirmation", async () => {
    const { EmailAlreadyRegisteredError } = await import("@sla/db");
    db.verifyEmail.mockRejectedValue(new EmailAlreadyRegisteredError("a@x.com"));
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({ token: "t" }));
    expect(response.status).toBe(409);
  });

  it("returns ok:true and the resulting email on success", async () => {
    db.verifyEmail.mockResolvedValue({ userId: "u1", email: "a@x.com" });
    const { POST } = await import("../src/app/api/email-verification/confirm/route");
    const response = await POST(postRequest({ token: "t" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, email: "a@x.com" });
  });
});
