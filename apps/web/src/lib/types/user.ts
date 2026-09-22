import type { UserRole } from "@sla/db";

export type { UserRole };

export type IUser = {
  id: string;
  organizationId: string;
  email: string;
  emailVerifiedAt: Date | null;
  name: string | null;
  image: string | null;
  role: UserRole;
  createdAt: Date;
};
