import { describe, expect, it } from "vitest";
import { validateOAuthState } from "../src/lib/oauth-state";

function encodeState(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

describe("validateOAuthState", () => {
  it("accepts a state that matches the cookie and the session's organization", () => {
    const state = encodeState({ nonce: "n1", organizationId: "org-a" });

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-a",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.organizationId).toBe("org-a");
    }
  });

  it("rejects with 403 when the state's organization doesn't match the session's — never trusting the URL's own claim", () => {
    const state = encodeState({ nonce: "n1", organizationId: "org-a" });

    const result = validateOAuthState({
      returnedState: state,
      cookieState: state,
      sessionOrganizationId: "org-b",
    });

    expect(result).toEqual({ ok: false, status: 403, error: "Organization mismatch" });
  });

  it("rejects with 400 when the returned state doesn't match the cookie", () => {
    const cookieState = encodeState({ nonce: "n1", organizationId: "org-a" });
    const returnedState = encodeState({ nonce: "n2", organizationId: "org-a" });

    const result = validateOAuthState({
      returnedState,
      cookieState,
      sessionOrganizationId: "org-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the state cookie is missing (expired or blocked)", () => {
    const returnedState = encodeState({ nonce: "n1", organizationId: "org-a" });

    const result = validateOAuthState({
      returnedState,
      cookieState: undefined,
      sessionOrganizationId: "org-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the cookie decodes to something that isn't a valid state object", () => {
    const cookieState = Buffer.from("not json").toString("base64url");

    const result = validateOAuthState({
      returnedState: cookieState,
      cookieState,
      sessionOrganizationId: "org-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });

  it("rejects with 400 when the decoded state has no organizationId", () => {
    const cookieState = encodeState({ nonce: "n1" });

    const result = validateOAuthState({
      returnedState: cookieState,
      cookieState,
      sessionOrganizationId: "org-a",
    });

    expect(result).toEqual({ ok: false, status: 400, error: "Invalid or expired OAuth state" });
  });
});
