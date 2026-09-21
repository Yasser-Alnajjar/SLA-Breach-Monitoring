import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signOAuthState, validateOAuthState, verifyOAuthState } from "../src/lib/oauth-state";

const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
});

afterEach(() => {
  process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
});

describe("validateOAuthState", () => {
  it("accepts a state that matches the cookie and the session's organization and user", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.organizationId).toBe("org-a");
      expect(result.state.userId).toBe("user-a");
    }
  });

  it("rejects with 403 when the state's organization doesn't match the session's — never trusting the URL's own claim", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-b",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 403, error: "Organization mismatch" });
  });

  it("rejects with 403 when the state's userId doesn't match the session's, even with the right organization", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-b",
    });

    expect(result).toEqual({ ok: false, status: 403, error: "Organization mismatch" });
  });

  it("rejects with 400 when the returned state doesn't match the cookie", () => {
    const cookieState = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });
    const returnedState = signOAuthState({ nonce: "n2", organizationId: "org-a", userId: "user-a" });

    const result = validateOAuthState({
      returnedState,
      cookieState,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the state cookie is missing (expired or blocked)", () => {
    const returnedState = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });

    const result = validateOAuthState({
      returnedState,
      cookieState: undefined,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the cookie has no valid signature at all", () => {
    const cookieState = Buffer.from("not json").toString("base64url");

    const result = validateOAuthState({
      returnedState: cookieState,
      cookieState,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the decoded state has no organizationId", () => {
    const cookieState = signOAuthState({ nonce: "n1", userId: "user-a" } as never);

    const result = validateOAuthState({
      returnedState: cookieState,
      cookieState,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the decoded state has no userId", () => {
    const cookieState = signOAuthState({ nonce: "n1", organizationId: "org-a" } as never);

    const result = validateOAuthState({
      returnedState: cookieState,
      cookieState,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects a tampered payload — same signature, different (attacker-edited) claims", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });
    const [encodedPayload, signature] = state.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ nonce: "n1", organizationId: "org-victim", userId: "user-a" })).toString(
      "base64url",
    );
    const tampered = `${tamperedPayload}.${signature}`;

    const result = validateOAuthState({
      returnedState: tampered,
      cookieState: tampered,
      sessionOrganizationId: "org-victim",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
    expect(encodedPayload).not.toBe(tamperedPayload);
  });

  it("rejects a state signed with a different secret (forged, or signed before a key rotation)", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a" });
    process.env.NEXTAUTH_SECRET = "a-different-secret";

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects a state with a missing signature segment", () => {
    const payload = Buffer.from(JSON.stringify({ nonce: "n1", organizationId: "org-a", userId: "user-a" })).toString("base64url");

    const result = validateOAuthState({
      returnedState: payload,
      cookieState: payload,
      sessionOrganizationId: "org-a",
      sessionUserId: "user-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });
});

describe("verifyOAuthState", () => {
  it("round-trips a signed payload", () => {
    const state = signOAuthState({ nonce: "n1", organizationId: "org-a", userId: "user-a", subdomain: "acme" });
    expect(verifyOAuthState(state)).toEqual({ nonce: "n1", organizationId: "org-a", userId: "user-a", subdomain: "acme" });
  });

  it("returns null for a malformed token", () => {
    expect(verifyOAuthState("not-a-valid-token")).toBeNull();
  });
});
