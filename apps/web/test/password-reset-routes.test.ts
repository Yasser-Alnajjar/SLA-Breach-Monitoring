/**
 * `POST /api/password-reset` and `POST /api/password-reset/confirm`
 * (roadmap 5.5): the public forgot/reset-password endpoints — no session,
 * the token is the credential for `confirm`. Pattern A, fully mocked
 * (`@sla/db`'s `requestPasswordReset`/`resetPassword`, `bcryptjs`,
 * `@/lib/transactional-email`). Error classes kept real via `importActual`
 * so the route's own `instanceof` branches are genuinely exercised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
const bcrypt = vi.hoisted(() => ({ hash: vi.fn(async () => "hashed-password") }));
const transactionalEmail = vi.hoisted(() => ({ sendTransactionalEmail: vi.fn(async () => {}) }));

vi.mock("@sla/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sla/db")>();
  return {
    ...actual,
    getPrismaClient: vi.fn(() => ({})),
    requestPasswordReset: db.requestPasswordReset,
    resetPassword: db.resetPassword,
  };
});
vi.mock("bcryptjs", () => ({ default: { hash: bcrypt.hash } }));
vi.mock("@/lib/transactional-email", () => ({ sendTransactionalEmail: transactionalEmail.sendTransactionalEmail }));

const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;

beforeEach(() => {
  vi.resetModules();
  db.requestPasswordReset.mockReset();
  db.resetPassword.mockReset();
  bcrypt.hash.mockClear();
  transactionalEmail.sendTransactionalEmail.mockReset();
  transactionalEmail.sendTransactionalEmail.mockResolvedValue(undefined);
  process.env.NEXTAUTH_URL = "https://sla.example.com";
});

afterEach(() => {
  process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
});

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/password-reset", () => {
  it("returns 400 for an invalid email, without calling requestPasswordReset", async () => {
    const { POST } = await import("../src/app/api/password-reset/route");
    const response = await POST(postRequest("http://localhost/api/password-reset", { email: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(db.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns ok:true and sends an email when the account exists", async () => {
    db.requestPasswordReset.mockResolvedValue({ userId: "u1", token: "raw-token" });
    const { POST } = await import("../src/app/api/password-reset/route");
    const response = await POST(postRequest("http://localhost/api/password-reset", { email: "a@x.com" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(transactionalEmail.sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("returns the identical ok:true, and sends no email, when no account exists — no enumeration signal", async () => {
    db.requestPasswordReset.mockResolvedValue(null);
    const { POST } = await import("../src/app/api/password-reset/route");
    const response = await POST(postRequest("http://localhost/api/password-reset", { email: "nobody@x.com" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(transactionalEmail.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("still returns ok:true when the email fails to send", async () => {
    db.requestPasswordReset.mockResolvedValue({ userId: "u1", token: "raw-token" });
    transactionalEmail.sendTransactionalEmail.mockRejectedValue(new Error("smtp down"));
    const { POST } = await import("../src/app/api/password-reset/route");
    const response = await POST(postRequest("http://localhost/api/password-reset", { email: "a@x.com" }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});

describe("POST /api/password-reset/confirm", () => {
  it("rejects a short password with 400 and never calls resetPassword", async () => {
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    const response = await POST(postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "short" }));
    expect(response.status).toBe(400);
    expect(db.resetPassword).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown token", async () => {
    const { PasswordResetTokenNotFoundError } = await import("@sla/db");
    db.resetPassword.mockRejectedValue(new PasswordResetTokenNotFoundError());
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    const response = await POST(
      postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "password123" }),
    );
    expect(response.status).toBe(404);
  });

  it("returns 410 for an expired token", async () => {
    const { PasswordResetTokenExpiredError } = await import("@sla/db");
    db.resetPassword.mockRejectedValue(new PasswordResetTokenExpiredError());
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    const response = await POST(
      postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "password123" }),
    );
    expect(response.status).toBe(410);
  });

  it("returns 410 for an already-used token", async () => {
    const { PasswordResetTokenUsedError } = await import("@sla/db");
    db.resetPassword.mockRejectedValue(new PasswordResetTokenUsedError());
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    const response = await POST(
      postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "password123" }),
    );
    expect(response.status).toBe(410);
  });

  it("hashes the password (bcrypt, cost 12) before calling resetPassword, and never forwards the raw password", async () => {
    db.resetPassword.mockResolvedValue({ userId: "u1" });
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    await POST(postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "password123" }));

    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);
    expect(db.resetPassword).toHaveBeenCalledWith(expect.anything(), {
      token: "t",
      passwordHash: "hashed-password",
    });
  });

  it("returns ok:true on success", async () => {
    db.resetPassword.mockResolvedValue({ userId: "u1" });
    const { POST } = await import("../src/app/api/password-reset/confirm/route");
    const response = await POST(
      postRequest("http://localhost/api/password-reset/confirm", { token: "t", password: "password123" }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
