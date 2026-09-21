import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveEncryptionKey } from "@sla/db";

/**
 * Decodes and validates the OAuth `state` param shared by every provider's
 * connect→callback flow. Every `connect/route.ts` builds `state` with
 * `signOAuthState` below (HMAC-SHA256 over base64url(JSON), mirroring the
 * inbound Jira webhook signature check in `packages/jira/src/webhook.ts`),
 * mirrored into an httpOnly SameSite=Lax cookie so the callback can compare
 * what came back against what it set (defense in depth alongside the
 * signature — an attacker who can't forge the signature still can't reuse a
 * state from a different session without also stealing that cookie).
 * Pulled out as pure functions so the tenant-isolation-critical checks —
 * `state.organizationId === session.user.organizationId` and
 * `state.userId === session.user.id` — are unit testable without a
 * route-handler harness.
 */
export type DecodedOAuthState = Record<string, unknown> & {
  organizationId: string;
  userId: string;
  nonce: string;
};

const OAUTH_STATE_SIGNING_SALT = "sla-breach-monitoring/oauth-state";

/**
 * Derives a stable HMAC key from the deployment's NEXTAUTH_SECRET — kept
 * distinct (via its own salt) from every other secret `deriveEncryptionKey`
 * derives from other env vars, so nothing here can collide with those.
 */
function getSigningKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET must be set to sign OAuth state");
  }
  return deriveEncryptionKey(secret, OAUTH_STATE_SIGNING_SALT);
}

/** Builds the signed `state` value: `<base64url(JSON)>.<base64url(HMAC-SHA256)>`. */
export function signOAuthState(
  payload: Record<string, unknown> & {
    organizationId: string;
    userId: string;
    nonce: string;
  },
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", getSigningKey())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies the signature (constant-time) before parsing or trusting
 * anything in the payload, then checks it has the required fields.
 * Returns null on any failure — malformed token, bad signature, or a
 * missing/wrong-typed required field — never a partially-trusted payload.
 */
export function verifyOAuthState(token: string): DecodedOAuthState | null {
  const separator = token.lastIndexOf(".");
  if (separator === -1) return null;
  const encodedPayload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);

  const expectedSignature = createHmac("sha256", getSigningKey())
    .update(encodedPayload)
    .digest("base64url");
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as Record<string, unknown>;
    if (
      typeof decoded.organizationId !== "string" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.nonce !== "string"
    ) {
      return null;
    }
    return decoded as DecodedOAuthState;
  } catch {
    return null;
  }
}

export type OAuthStateValidation =
  | { ok: true; state: DecodedOAuthState }
  | { ok: false; status: 400; error: "Invalid or expired OAuth state" }
  | { ok: false; status: 403; error: "Organization mismatch" };

export function validateOAuthState(params: {
  returnedState: string | null;
  cookieState: string | null | undefined;
  sessionOrganizationId: string;
  sessionUserId: string;
}): OAuthStateValidation {
  const { returnedState, cookieState, sessionOrganizationId, sessionUserId } =
    params;

  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return { ok: false, status: 400, error: "Invalid or expired OAuth state" };
  }

  const state = verifyOAuthState(cookieState);
  if (!state) {
    return { ok: false, status: 400, error: "Invalid or expired OAuth state" };
  }

  if (
    state.organizationId !== sessionOrganizationId ||
    state.userId !== sessionUserId
  ) {
    return { ok: false, status: 403, error: "Organization mismatch" };
  }

  return { ok: true, state };
}
