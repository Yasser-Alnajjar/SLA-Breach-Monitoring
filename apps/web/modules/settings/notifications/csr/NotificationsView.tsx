"use client";

import { Reveal } from "@/components/shared/reveal";
import type { NotificationSettingsData } from "@/lib/types/notification-settings";
import { EmailNotificationsCard } from "./EmailNotificationsCard";

interface NotificationsViewProps {
  data: NotificationSettingsData;
}

/**
 * Org-wide alert channel configuration — email today, alongside Slack (which
 * lives on the Integrations page since it's an OAuth connection, not a
 * standing credential form). Kept on its own page rather than folded into
 * Integrations: this isn't a provider connection, it's how the SLA engine's
 * own alerts get delivered.
 */
export const NotificationsView = ({ data }: NotificationsViewProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure how at-risk and breach alerts reach this organization.
        </p>
      </div>

      <Reveal delay={0}>
        <EmailNotificationsCard status={data.emailSettings} />
      </Reveal>
    </div>
  );
};
