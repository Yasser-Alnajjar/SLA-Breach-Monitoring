import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import type { OrganizationSettingsData } from "@/lib/types/organization";

export const OrganizationActions = {
  async getData(): Promise<OrganizationSettingsData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const organization = await getPrismaClient().organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, timezone: true },
    });
    if (!organization) redirect("/sign-in");

    return { ...organization, canEdit: session.user.role === "owner" };
  },
};
