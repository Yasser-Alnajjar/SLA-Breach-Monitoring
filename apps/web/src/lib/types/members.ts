import type { UserRole } from "@sla/db";

export interface OrganizationMemberSummary {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}
