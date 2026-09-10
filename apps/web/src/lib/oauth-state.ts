/**
 * Decodes and validates the OAuth `state` param shared by the Zendesk/Jira/
 * Slack connect→callback flows. Every callback route builds `state` the
 * same way (`connect/route.ts`): base64url(JSON({ nonce, organizationId,
 * ...provider-specific fields })), mirrored into an httpOnly SameSite=Lax
 * cookie so the callback can compare what came back against what it set.
 * Pulled out as a pure function so the tenant-isolation-critical check —
 * `state.organizationId === session.user.organizationId` — is unit
 * testable without a route-handler harness. The comparison's meaning must
 * not change: this only moves the existing logic, verbatim, out of three
 * near-identical route files.
 */
export type DecodedOAuthState = Record<string, unknown> & { organizationId: string };

export type OAuthStateValidation =
  | { ok: true; state: DecodedOAuthState }
  | { ok: false; status: 400; error: "Invalid or expired OAuth state" }
  | { ok: false; status: 403; error: "Organization mismatch" };

export function validateOAuthState(params: {
  returnedState: string | null;
  cookieState: string | null | undefined;
  sessionOrganizationId: string;
}): OAuthStateValidation {
  const { returnedState, cookieState, sessionOrganizationId } = params;

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return { ok: false, status: 400, error: "Invalid or expired OAuth state" };
  }

  let state: DecodedOAuthState;
  try {
    const decoded = JSON.parse(Buffer.from(cookieState, "base64url").toString("utf-8")) as Record<string, unknown>;
    if (typeof decoded.organizationId !== "string") {
      return { ok: false, status: 400, error: "Invalid or expired OAuth state" };
    }
    state = decoded as DecodedOAuthState;
  } catch {
    return { ok: false, status: 400, error: "Invalid or expired OAuth state" };
  }

  if (state.organizationId !== sessionOrganizationId) {
    return { ok: false, status: 403, error: "Organization mismatch" };
  }

  return { ok: true, state };
}
