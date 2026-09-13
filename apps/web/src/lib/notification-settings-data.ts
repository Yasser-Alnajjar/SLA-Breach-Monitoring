import type { PrismaClient } from "@sla/db";
import { getEmailSettingsStatus } from "@sla/db";
import type { NotificationSettingsData } from "./types/notification-settings";

/** Assembles the Notifications settings page's read model — org-wide alert channel configuration, not tied to any single provider integration. */
export async function getNotificationSettingsData(
  prisma: PrismaClient,
  organizationId: string,
): Promise<NotificationSettingsData> {
  const emailSettings = await getEmailSettingsStatus(prisma, organizationId);
  return { emailSettings };
}
