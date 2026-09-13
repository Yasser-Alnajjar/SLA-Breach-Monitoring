import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getNotificationSettingsData } from "@/lib/notification-settings-data";
import type { NotificationSettingsData } from "@/lib/types/notification-settings";

export const NotificationsActions = {
  async getData(): Promise<NotificationSettingsData> {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/sign-in");

    const prisma = getPrismaClient();
    return getNotificationSettingsData(prisma, session.user.organizationId);
  },
};
