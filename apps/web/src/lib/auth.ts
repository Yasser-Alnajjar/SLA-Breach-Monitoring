import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrismaClient } from "@sla/db";
import { encodeAuthThrottleError } from "@/lib/auth-rate-limit";
import { clientIpFromHeaders } from "@/lib/rate-limit";
import {
  checkAuthThrottle,
  clearAuthThrottle,
  normalizeLoginIdentity,
  recordFailedAuthAttempt,
} from "@/lib/auth-throttle";

/**
 * A precomputed bcrypt hash of a value nothing will ever type as a real
 * password. Compared against on the "no such user" path below so that
 * branch costs the same bcrypt work as a real wrong-password check —
 * without it, an unrecognized email would return a full compare faster
 * than an existing one, i.e. a response-time oracle for user enumeration
 * (identical return value and error message already prevent enumeration
 * *by content*; this closes the same gap in *timing*). Computed once at
 * module load, same cost factor (12) as `/api/sign-up`'s real hashing.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("no-such-user-placeholder", 12);

/**
 * Client IP from the plain headers object NextAuth hands `authorize()`, with
 * the same right-to-left `X-Forwarded-For` rule as `getClientIp` in
 * `@/lib/rate-limit`.
 */
function getAuthorizeClientIp(headers: Record<string, unknown> | undefined): string {
  const headerValue = (value: unknown) => {
    const joined = Array.isArray(value) ? value.join(",") : value;
    return typeof joined === "string" ? joined : null;
  };
  return clientIpFromHeaders(headerValue(headers?.["x-forwarded-for"]), headerValue(headers?.["x-real-ip"]));
}

/**
 * JWT sessions (not database sessions) — the Credentials provider requires
 * it. `role` (owner/member — see the `User.role` schema doc comment) is
 * carried on the token itself rather than looked up per-request; it only
 * ever changes at sign-up, so there is nothing to invalidate mid-session.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Progressive throttle for repeated failed attempts (roadmap step 30
        // follow-up) — see `@/lib/auth-throttle`. Checked before any
        // database/password work so a throttled key never gets a real
        // credential check for free.
        //
        // Keyed on normalized email + client IP rather than email alone: an
        // email-only key would let anyone force a cooldown onto another
        // person's account just by failing logins against it from anywhere,
        // which is exactly the DoS-via-throttle this feature must not
        // introduce. Scoping to the caller's own IP as well means a stranger
        // can only ever throttle *their own* attempts against that email —
        // never the real owner's, who logs in from a different IP.
        // The DB lookup key below stays the bare normalized email; only the
        // throttle is scoped to the IP.
        const identity = normalizeLoginIdentity(credentials.email);
        const throttleKey = `${identity}:${getAuthorizeClientIp(req?.headers)}`;
        const throttle = checkAuthThrottle(throttleKey);
        if (throttle.throttled) {
          throw new Error(encodeAuthThrottleError(throttle.retryAfterSeconds ?? 60));
        }

        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { email: identity },
        });
        if (!user) {
          // Same return value, same error message, and — via the dummy
          // compare above — the same rough latency as a wrong password:
          // an unrecognized email must be indistinguishable from an
          // existing one with the wrong password, or it becomes a
          // user-enumeration oracle.
          await bcrypt.compare(credentials.password, DUMMY_PASSWORD_HASH);
          recordFailedAuthAttempt(throttleKey);
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) {
          recordFailedAuthAttempt(throttleKey);
          return null;
        }

        clearAuthThrottle(throttleKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          organizationId: user.organizationId,
          role: user.role,
          createdAt: user.createdAt,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.image = user.image;
        token.role = user.role;
      }
      // Fired by the client's `useSession().update(...)` (see the Profile
      // page) right after `/api/me` saves a name change — merges it into
      // this JWT cookie so `useSession()` reflects the edit without a full
      // re-login. Deliberately excludes the avatar: it's stored as a
      // `data:` URL (no external image host — see `updateProfileSchema`),
      // and a JWT this app doesn't chunk across multiple cookies is the
      // wrong place for one. The sidebar avatar instead reads straight from
      // the database on every request — see `(main)/layout.tsx`.
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.organizationId = token.organizationId;
      session.user.image = token.image ?? null;
      session.user.role = token.role;
      return session;
    },
  },
};
