import type { DefaultSession } from "next-auth";
import type { IUser } from "@/lib/types/user";

declare module "next-auth" {
  interface Session {
    user: IUser & DefaultSession["user"];
  }

  /**
   * `sessionVersion` (roadmap 5.7) is deliberately not part of `IUser` — it
   * is never displayed and never needed by anything reading `Session.user`
   * (every page that shows account fields reads fresh from the database
   * instead, see `EmailCard`'s doc comment in the Profile module); it
   * exists only to round-trip from `authorize()` into the JWT, where
   * `auth.ts`'s `jwt` callback re-checks it on every subsequent request.
   */
  interface User extends IUser {
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    image?: string | null;
    role: IUser["role"];
    /** See `User.sessionVersion`'s doc comment above. */
    sessionVersion: number;
  }
}
