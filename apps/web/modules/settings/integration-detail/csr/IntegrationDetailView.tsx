"use client";

import {
  ArrowLeft,
  GitBranch,
  RefreshCw,
  Ticket,
  Webhook as WebhookIcon,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationDetailData,
} from "@/lib/types/integrations";
import type { ZendeskCredentials } from "@sla/zendesk";
import { ZendeskBackfillButton } from "../../integrations/csr/ZendeskCard";
import { JiraBackfillButton } from "../../integrations/csr/JiraCard";
import { LinearBackfillButton } from "../../integrations/csr/LinearCard";
import { WebhookInfo } from "../../integrations/csr/WebhookInfo";
import { Utils } from "@/lib/utils";

const PROVIDER_ICONS: Record<IntegrationDetailData["provider"], ReactNode> = {
  zendesk: <Ticket className="size-4" />,
  jira: <GitBranch className="size-4" />,
  linear: <Workflow className="size-4" />,
};

const iconWrapper =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground";

const descriptionClass = "text-sm leading-6 text-muted-foreground";

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={iconWrapper}>{icon}</span>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}

interface IntegrationDetailViewProps {
  data: IntegrationDetailData;
}

export function IntegrationDetailView({ data }: IntegrationDetailViewProps) {
  const { provider, integration, credentials, cursor } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <a
        href="/settings/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Integrations
      </a>

      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={iconWrapper}>{PROVIDER_ICONS[provider]}</span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-medium tracking-tight">
                {INTEGRATION_PROVIDER_LABELS[provider]}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Connected {Utils.formatDate(`${integration.connectedAt}`)}
              </p>
            </div>
          </div>
          <Badge
            variant={
              integration.status === "reauth_required" ? "warning" : "success"
            }
            className="shrink-0"
          >
            {integration.status === "reauth_required"
              ? "Needs reconnect"
              : "Connected"}
          </Badge>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <SectionCard
          icon={<RefreshCw className="size-4" />}
          title="Sync status"
          description="Backfill and polling health"
        >
          <div className="space-y-2">
            <p className={descriptionClass}>
              {cursor?.backfillCompletedAt
                ? `90-day backfill complete as of ${Utils.formatDate(cursor.backfillCompletedAt)}.`
                : "No backfill run yet."}
            </p>
            {integration.lastSyncAt && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Last sync attempt{" "}
                {Utils.formatDate(`${integration.lastSyncAt}`)}
                {integration.lastSyncError ? (
                  <span className="text-destructive">
                    {" "}
                    — {integration.lastSyncError}
                  </span>
                ) : (
                  " — succeeded."
                )}
              </p>
            )}
          </div>
        </SectionCard>
      </Reveal>

      <Reveal delay={0.1}>
        <SectionCard
          icon={<RefreshCw className="size-4" />}
          title="Data backfill"
          description="Import the last 90 days of data"
        >
          {provider === "zendesk" && (
            <ZendeskBackfillButton
              subdomain={(credentials as ZendeskCredentials).subdomain}
              initialReauthRequired={credentials.reauthRequired === true}
            />
          )}
          {provider === "jira" && (
            <JiraBackfillButton
              initialReauthRequired={credentials.reauthRequired === true}
            />
          )}
          {provider === "linear" && (
            <LinearBackfillButton
              initialReauthRequired={credentials.reauthRequired === true}
            />
          )}
        </SectionCard>
      </Reveal>

      {(provider === "zendesk" || provider === "jira") && (
        <Reveal delay={0.15}>
          <SectionCard
            icon={<WebhookIcon className="size-4" />}
            title="Real-time webhook"
            description="Close the gap between polls"
          >
            <WebhookInfo
              provider={provider}
              integrationId={integration.id}
              webhookSecret={integration.webhookSecret}
            />
          </SectionCard>
        </Reveal>
      )}
    </div>
  );
}
