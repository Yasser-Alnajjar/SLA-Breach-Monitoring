"use client";

import { Lock, Mail, ShieldCheck, Server, History } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import type { NotificationSettingsData } from "@/lib/types/notification-settings";
import { EMAIL_SECURITY_OPTIONS } from "@/lib/types/email-settings";
import { EmailNotificationsCard } from "./EmailNotificationsCard";

interface NotificationsViewProps {
  data: NotificationSettingsData;
}

function StatusTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "success";
}) {
  return (
    <div className="bg-surface-container-low flex items-center justify-between gap-3 rounded-lg p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-outline font-mono text-xxs font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span
          className={`truncate font-mono text-sm font-semibold ${tone === "success" ? "text-tertiary" : "text-on-surface"}`}
        >
          {value}
        </span>
      </div>
      <span className="text-primary shrink-0">{icon}</span>
    </div>
  );
}

/**
 * Org-wide alert channel configuration — email today, alongside Slack (which
 * lives on the Integrations page since it's an OAuth connection, not a
 * standing credential form). Kept on its own page rather than folded into
 * Integrations: this isn't a provider connection, it's how the SLA engine's
 * own alerts get delivered.
 */
export const NotificationsView = ({ data }: NotificationsViewProps) => {
  const { emailSettings: email } = data;
  const securityLabel =
    EMAIL_SECURITY_OPTIONS.find((o) => o.value === email.security)?.label ?? "—";

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-low flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-1.5 shadow-sm">
        <div className="text-outline flex min-w-0 items-center gap-2 font-mono text-xxs uppercase tracking-widest">
          <span>Settings</span>
          <span>/</span>
          <span>Outbound Alerts</span>
          <span>/</span>
          <span className="text-primary font-semibold">Alert Channels</span>
        </div>

        <span className="bg-surface-container text-primary flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xxs">
          <Lock className="size-3" />
          MUTATION LOCK: ACTIVE (OWNER PRIVILEGES)
        </span>
      </div>

      <div>
        <span className="text-secondary font-mono text-xxs font-semibold uppercase tracking-widest">
          Outbound alerts &amp; webhooks
        </span>
        <h2 className="text-on-surface font-display mt-1 text-xl font-medium tracking-tight">
          Alert Channels
        </h2>
        <p className="text-on-surface-variant mt-1 max-w-4xl text-sm">
          Configure how at-risk and breach alerts reach this organization before
          contractual SLAs breach.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusTile
          label="Email channel"
          value={email.configured ? "Configured" : "Not configured"}
          tone={email.configured ? "success" : undefined}
          icon={<Mail className="size-5" />}
        />
        <StatusTile
          label="SMTP host"
          value={email.host ? `${email.host}:${email.port}` : "—"}
          icon={<Server className="size-5" />}
        />
        <StatusTile
          label="Security"
          value={securityLabel}
          icon={<ShieldCheck className="size-5" />}
        />
        <StatusTile
          label="Last updated"
          value={email.updatedAt ? new Date(email.updatedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—"}
          icon={<History className="size-5" />}
        />
      </div>

      <Reveal delay={0}>
        <EmailNotificationsCard status={email} />
      </Reveal>
    </div>
  );
};
