"use client";

import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FileArchive,
  GitBranch,
  GitPullRequest,
  LifeBuoy,
  RefreshCw,
  Ticket,
  Webhook as WebhookIcon,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { PermissionDeniedBanner } from "@/components/shared/permission-denied-banner";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONCIERGE_PROVIDER_COPY } from "@/lib/concierge-providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INTEGRATION_PROVIDER_LABELS,
  type IntegrationDetailData,
} from "@/lib/types/integrations";
import { Utils } from "@/lib/utils";
import { ZendeskBackfillButton } from "../../integrations/csr/ZendeskCard";
import { JiraBackfillButton } from "../../integrations/csr/JiraCard";
import { LinearBackfillButton } from "../../integrations/csr/LinearCard";
import { IntercomBackfillButton } from "../../integrations/csr/IntercomCard";
import { GithubBackfillButton } from "../../integrations/csr/GithubCard";
import { WebhookInfo } from "../../integrations/csr/WebhookInfo";
import Link from "next/link";

const PROVIDER_ICONS: Record<IntegrationDetailData["provider"], ReactNode> = {
  zendesk: <Ticket className="size-4" />,
  jira: <GitBranch className="size-4" />,
  linear: <Workflow className="size-4" />,
  intercom: <LifeBuoy className="size-4" />,
  github: <GitPullRequest className="size-4" />,
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
  const {
    provider,
    integrationId,
    connectedAt,
    reauthRequired,
    permissionDenied,
    lastSyncAt,
    lastSyncError,
    backfillCompletedAt,
    webhookSecret,
    subdomain,
    repo,
  } = data;

  /** Where an admin manages this provider's OAuth app / developer account — shown always, not just while unconfigured, so it's easy to find again later. */
  const PROVIDER_APP_URLS: Record<IntegrationDetailData["provider"], string> = {
    zendesk: `https://${subdomain}.zendesk.com`,
    jira: "https://www.atlassian.com/software/jira?referer=jira.com",
    linear: "https://linear.app",
    intercom: "https://intercom.com",
    github: repo ? `https://github.com/${repo}` : "https://github.com",
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/settings/integrations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Integrations
      </Link>

      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={iconWrapper}>{PROVIDER_ICONS[provider]}</span>

            <div className="min-w-0">
              <h1 className="font-display text-xl font-medium tracking-tight">
                {INTEGRATION_PROVIDER_LABELS[provider]}
              </h1>

              <p className="mt-0.5 text-sm text-muted-foreground">
                Connected {Utils.formatDateTimeV2(connectedAt)}
              </p>
            </div>
          </div>

          <Badge
            variant={reauthRequired || permissionDenied ? "warning" : "success"}
            className="shrink-0"
          >
            {reauthRequired
              ? "Needs reconnect"
              : permissionDenied
                ? "Access restricted"
                : "Connected"}
          </Badge>
        </div>

        {PROVIDER_APP_URLS[provider] && (
          <a
            href={PROVIDER_APP_URLS[provider]}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            Open {INTEGRATION_PROVIDER_LABELS[provider]}
            <ExternalLink className="size-3" />
          </a>
        )}
      </Reveal>

      <Reveal delay={0.05}>
        <SectionCard
          icon={<RefreshCw className="size-4" />}
          title="Sync status"
          description="Backfill and polling health"
        >
          <div className="space-y-2">
            {permissionDenied && !reauthRequired && (
              <PermissionDeniedBanner
                provider={INTEGRATION_PROVIDER_LABELS[provider]}
              />
            )}

            <p className={descriptionClass}>
              {backfillCompletedAt
                ? `90-day backfill complete as of ${Utils.formatDateTimeV2(
                    backfillCompletedAt,
                  )}.`
                : "No backfill run yet."}
            </p>

            {lastSyncAt && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Last sync attempt {Utils.formatDateTimeV2(lastSyncAt)}
                {lastSyncError ? (
                  <span className="text-destructive"> — {lastSyncError}</span>
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
              subdomain={subdomain ?? ""}
              initialReauthRequired={reauthRequired}
            />
          )}

          {provider === "jira" && (
            <JiraBackfillButton initialReauthRequired={reauthRequired} />
          )}

          {provider === "linear" && (
            <LinearBackfillButton initialReauthRequired={reauthRequired} />
          )}

          {provider === "intercom" && (
            <IntercomBackfillButton initialReauthRequired={reauthRequired} />
          )}

          {provider === "github" && (
            <GithubBackfillButton
              repo={repo ?? ""}
              initialReauthRequired={reauthRequired}
            />
          )}
        </SectionCard>
      </Reveal>

      {(provider === "zendesk" || provider === "jira") && (
        <Reveal delay={0.15}>
          <SectionCard
            icon={<FileArchive className="size-4" />}
            title="Concierge export"
            description={`${INTEGRATION_PROVIDER_LABELS[provider]} data for the Concierge SLA analysis`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={descriptionClass}>
                {provider === "jira"
                  ? "Download issues and their status history from Jira's changelog as CSVs."
                  : "Download tickets and their status changes from Zendesk's ticket audits as CSVs."}
              </p>
              <Button variant="outline" size="sm" className="text-nowrap" asChild>
                <Link href={CONCIERGE_PROVIDER_COPY[provider].exportHref}>
                  Open export
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </SectionCard>
        </Reveal>
      )}

      {(provider === "zendesk" || provider === "jira") && (
        <Reveal delay={0.2}>
          <SectionCard
            icon={<WebhookIcon className="size-4" />}
            title="Real-time webhook"
            description="Close the gap between polls"
          >
            <WebhookInfo
              provider={provider}
              integrationId={integrationId}
              webhookSecret={webhookSecret}
            />
          </SectionCard>
        </Reveal>
      )}
    </div>
  );
}
