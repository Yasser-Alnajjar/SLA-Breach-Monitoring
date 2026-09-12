import type { DefaultSession } from "next-auth";
import type { IUser } from "@/lib/types/user";

declare module "next-auth" {
  interface Session {
    user: IUser & DefaultSession["user"];
  }

  interface User extends IUser {}
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    image?: string | null;
  }
}
