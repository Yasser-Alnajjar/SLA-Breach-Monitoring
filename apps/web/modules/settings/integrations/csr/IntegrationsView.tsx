"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import {
  ChevronRight,
  GitBranch,
  GitPullRequest,
  LifeBuoy,
  MessageSquare,
  Ticket,
  Workflow,
} from "lucide-react";
import { PermissionDeniedBanner } from "@/components/shared/permission-denied-banner";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ConfigurableIntegrationProvider,
  IntegrationConnectionView,
  IntegrationsPageData,
} from "@/lib/types/integrations";
import { ZendeskConnectForm } from "./ZendeskCard";
import { JiraConnectButton } from "./JiraCard";
import { LinearConnectButton } from "./LinearCard";
import { IntercomConnectButton } from "./IntercomCard";
import { GithubConnectForm } from "./GithubCard";
import {
  SlackConnectButton,
  SlackChannelPicker,
  SlackChannelChangeButton,
} from "./SlackCard";
import { DisconnectButton } from "./DisconnectButton";
import { IntegrationConfigGate } from "./IntegrationConfigGate";
import Link from "next/link";

interface IntegrationsViewProps {
  data: IntegrationsPageData;
}

const descriptionClass = "text-sm text-on-surface-variant";
const statusToneClasses = {
  success: { dot: "bg-success", text: "text-success" },
  warning: { dot: "bg-warning", text: "text-warning" },
  muted: { dot: "bg-muted-foreground/60", text: "text-on-surface-variant" },
} as const;

function StatusIndicator({
  tone,
  label,
}: {
  tone: keyof typeof statusToneClasses;
  label: string;
}) {
  const { dot, text } = statusToneClasses[tone];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded px-2 py-1",
        tone === "success" ? "bg-success/10" : "bg-surface-container",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dot,
          tone === "success" && "animate-pulse",
        )}
      />
      <span className={cn("font-mono text-xxs font-semibold", text)}>
        {label}
      </span>
    </span>
  );
}

function ConnectedStatus({ view }: { view: IntegrationConnectionView }) {
  if (view.reauthRequired) {
    return <StatusIndicator tone="warning" label="Needs reconnect" />;
  }
  if (view.permissionDenied) {
    return <StatusIndicator tone="warning" label="Access restricted" />;
  }
  return <StatusIndicator tone="success" label="Connected" />;
}

function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo" });
}

/**
 * Shared card shell for provider integrations — a flat single surface (no
 * header divider) so the four cards read as lightweight tiles rather than
 * boxed panels.
 */
function IntegrationCard({
  delay,
  icon,
  connected,
  title,
  badge,
  status,
  children,
}: {
  delay: number;
  icon: React.ReactNode;
  connected: boolean;
  title: string;
  /** Optional label next to the title — e.g. `<Badge variant="beta">Beta</Badge>` for Intercom/Linear/GitHub (roadmap task 2.10). */
  badge?: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="bg-surface-container-low relative flex h-full flex-col gap-4 overflow-hidden rounded-xl border-0 p-6 shadow-sm">
        {connected && (
          <div className="bg-tertiary absolute bottom-0 left-0 top-0 w-1" />
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "bg-surface-container-highest flex size-10 shrink-0 items-center justify-center rounded",
                connected ? "text-primary" : "text-outline",
              )}
            >
              {icon}
            </span>

            <CardTitle className="text-on-surface truncate text-lg font-medium">
              {title}
            </CardTitle>

            {badge}
          </div>

          {status}
        </div>

        <div className="flex flex-1 flex-col">{children}</div>
      </Card>
    </Reveal>
  );
}

/**
 * A connected integration's card only handles connect/disconnect —
 * everything else (backfill, real-time webhooks, sync health) lives on its
 * own `/settings/integrations/[provider]` page now, which has the room a
 * narrow card column never did for a multi-line result summary or a
 * copyable webhook URL.
 */
function ConnectedCardBody({
  provider,
  providerLabel,
  connectedAt,
  permissionDenied,
  disconnectHint,
}: {
  provider: "zendesk" | "jira" | "linear" | "intercom" | "github";
  providerLabel: string;
  connectedAt: Date;
  permissionDenied: boolean;
  disconnectHint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {permissionDenied && <PermissionDeniedBanner provider={providerLabel} />}
      <p className={descriptionClass}>
        Connected {formatDateTime(connectedAt)}.
        {disconnectHint && ` ${disconnectHint}`}
      </p>

      <div className="mt-auto pt-6 flex items-center gap-2">
        <DisconnectButton provider={provider} providerLabel={providerLabel} />
        <Button variant="surface" className="text-nowrap" size="sm" asChild>
          <Link href={`/settings/integrations/${provider}`}>
            Manage
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** One integration card's static shell (icon/tone/badge) plus its fully-rendered status and body — the pieces that vary per provider. */
interface IntegrationCardConfig {
  provider: ConfigurableIntegrationProvider;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  connected: boolean;
  status: React.ReactNode;
  body: React.ReactNode;
}

export const IntegrationsView = ({ data }: IntegrationsViewProps) => {
  const {
    zendesk,
    zendeskConfig,
    jira,
    jiraConfig,
    linear,
    linearConfig,
    intercom,
    intercomConfig,
    github,
    githubConfig,
    slack,
    slackConfig,
  } = data;

  const integrations: IntegrationCardConfig[] = [
    {
      provider: "zendesk",
      label: "Zendesk",
      icon: <Ticket className="size-4" />,
      connected: zendesk.connected,
      status:
        zendeskConfig.configured &&
        (zendesk.connected ? (
          <ConnectedStatus view={zendesk} />
        ) : (
          zendesk.disconnectedAt && (
            <StatusIndicator tone="muted" label="Disconnected" />
          )
        )),
      body: (
        <IntegrationConfigGate
          provider="zendesk"
          providerLabel="Zendesk"
          config={zendeskConfig}
          descriptionClass={descriptionClass}
          helpUrl="https://support.zendesk.com/hc/en-us/articles/4408845965210-Using-OAuth-authentication-with-your-application"
          helpLabel="Get your Zendesk OAuth app credentials"
        >
          {zendesk.connected ? (
            <ConnectedCardBody
              provider="zendesk"
              providerLabel="Zendesk"
              connectedAt={zendesk.connectedAt!}
              permissionDenied={zendesk.permissionDenied}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                Read-only access — no tickets, comments, or fields are ever
                written back to Zendesk.
                {zendesk.disconnectedAt &&
                  ` Disconnected ${formatDateTime(zendesk.disconnectedAt)}.`}
              </p>

              <div className="mt-auto pt-6">
                <ZendeskConnectForm />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
    {
      provider: "jira",
      label: "Jira",
      icon: <GitBranch className="size-4" />,
      connected: jira.connected,
      status:
        jiraConfig.configured &&
        (jira.connected ? (
          <ConnectedStatus view={jira} />
        ) : (
          jira.disconnectedAt && (
            <StatusIndicator tone="muted" label="Disconnected" />
          )
        )),
      body: (
        <IntegrationConfigGate
          provider="jira"
          providerLabel="Jira"
          config={jiraConfig}
          descriptionClass={descriptionClass}
          helpUrl="https://developer.atlassian.com/console/myapps/"
          helpLabel="Get your Jira OAuth app credentials"
        >
          {jira.connected ? (
            <ConnectedCardBody
              provider="jira"
              providerLabel="Jira"
              connectedAt={jira.connectedAt!}
              permissionDenied={jira.permissionDenied}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                Read-only access — no issues, comments, or fields are ever
                written back to Jira.
                {jira.disconnectedAt &&
                  ` Disconnected ${formatDateTime(jira.disconnectedAt)}.`}
              </p>

              <div className="mt-auto pt-6">
                <JiraConnectButton />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
    {
      provider: "linear",
      label: "Linear",
      icon: <Workflow className="size-4" />,
      badge: <Badge variant="beta">Beta</Badge>,
      connected: linear.connected,
      status: linear.connected ? (
        <ConnectedStatus view={linear} />
      ) : (
        linear.disconnectedAt && (
          <StatusIndicator tone="muted" label="Disconnected" />
        )
      ),
      body: (
        <IntegrationConfigGate
          provider="linear"
          providerLabel="Linear"
          config={linearConfig}
          descriptionClass={descriptionClass}
          helpUrl="https://linear.app/settings/api"
          helpLabel="Get your Linear OAuth app credentials"
        >
          {linear.connected ? (
            <ConnectedCardBody
              provider="linear"
              providerLabel="Linear"
              connectedAt={linear.connectedAt!}
              permissionDenied={linear.permissionDenied}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                Read-only access — no issues, comments, or fields are ever
                written back to Linear. An alternative engineering-leg source
                alongside Jira, not a replacement.
                {linear.disconnectedAt &&
                  ` Disconnected ${formatDateTime(linear.disconnectedAt)}.`}
              </p>

              <div className="mt-auto pt-6">
                <LinearConnectButton />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
    {
      provider: "intercom",
      label: "Intercom",
      icon: <LifeBuoy className="size-4" />,
      badge: <Badge variant="beta">Beta</Badge>,
      connected: intercom.connected,
      status:
        intercomConfig.configured &&
        (intercom.connected ? (
          <ConnectedStatus view={intercom} />
        ) : (
          intercom.disconnectedAt && (
            <StatusIndicator tone="muted" label="Disconnected" />
          )
        )),
      body: (
        <IntegrationConfigGate
          provider="intercom"
          providerLabel="Intercom"
          config={intercomConfig}
          descriptionClass={descriptionClass}
          helpUrl="https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth?utm_source=chatgpt.com"
          helpLabel="Get your Intercom OAuth app credentials"
        >
          {intercom.connected ? (
            <ConnectedCardBody
              provider="intercom"
              providerLabel="Intercom"
              connectedAt={intercom.connectedAt!}
              permissionDenied={intercom.permissionDenied}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                Read-only access — no conversations, contacts, or fields are
                ever written back to Intercom. An alternative ticket source
                alongside Zendesk, not a replacement.
                {intercom.disconnectedAt &&
                  ` Disconnected ${formatDateTime(intercom.disconnectedAt)}.`}
              </p>

              <div className="mt-auto pt-6">
                <IntercomConnectButton />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
    {
      provider: "github",
      label: "GitHub",
      icon: <GitPullRequest className="size-4" />,
      badge: <Badge variant="beta">Beta</Badge>,
      connected: github.connected,
      status:
        githubConfig.configured &&
        (github.connected ? (
          <ConnectedStatus view={github} />
        ) : (
          github.disconnectedAt && (
            <StatusIndicator tone="muted" label="Disconnected" />
          )
        )),
      body: (
        <IntegrationConfigGate
          provider="github"
          providerLabel="GitHub"
          config={githubConfig}
          descriptionClass={descriptionClass}
          helpUrl="/docs/integrations/github#create-github-app"
          helpLabel="Create your read-only GitHub App"
        >
          {github.connected ? (
            <ConnectedCardBody
              provider="github"
              providerLabel="GitHub"
              connectedAt={github.connectedAt!}
              permissionDenied={github.permissionDenied}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                Read-only access — no pull requests, reviews, or code are ever
                written back to GitHub. An engineering-leg source alongside
                Jira/Linear, correlated through whichever issue a pull request
                already references.
                {github.disconnectedAt &&
                  ` Disconnected ${formatDateTime(github.disconnectedAt)}.`}
              </p>

              <div className="mt-auto pt-6">
                <GithubConnectForm />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
    {
      provider: "slack",
      label: "Slack",
      icon: <MessageSquare className="size-4" />,
      connected: slack.connected,
      status: slackConfig.configured && slack.connected && (
        <StatusIndicator tone="success" label="Connected" />
      ),
      body: (
        <IntegrationConfigGate
          provider="slack"
          providerLabel="Slack"
          config={slackConfig}
          descriptionClass={descriptionClass}
          helpUrl="https://api.slack.com/apps"
          helpLabel="Get your Slack app credentials"
        >
          {slack.connected ? (
            <div className="flex flex-1 flex-col">
              <div className="space-y-3">
                <p className={descriptionClass}>
                  Connected to {slack.teamName}{" "}
                  {formatDateTime(slack.installedAt!)}.
                </p>

                {slack.channelId && (
                  <p className={descriptionClass}>
                    At-risk and breach alerts post to #{slack.channelName}.
                  </p>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                {slack.channelId ? (
                  <SlackChannelChangeButton />
                ) : (
                  <SlackChannelPicker />
                )}
                <DisconnectButton provider="slack" providerLabel="Slack" />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className={descriptionClass}>
                The only alert channel in v1. Posts when a commitment crosses a
                warning threshold or breaches.
              </p>

              <div className="mt-auto pt-6">
                <SlackConnectButton />
              </div>
            </div>
          )}
        </IntegrationConfigGate>
      ),
    },
  ];

  // Connected integrations first; stable sort preserves original relative
  // order within each group without mutating `integrations`.
  const sortedIntegrations = [...integrations].sort(
    (a, b) => Number(b.connected) - Number(a.connected),
  );

  return (
    <div className="space-y-8">
      {/* Integrations */}
      <section className="space-y-4">
        <SettingsSectionHeader
          eyebrow="Data ingestion pipelines"
          title="Ticket & Issue Integrations (Read-Only)"
          description="Connect your support, engineering, and alerting systems."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sortedIntegrations.map((integration, index) => (
            <IntegrationCard
              key={integration.provider}
              delay={index * 0.05}
              icon={integration.icon}
              connected={integration.connected}
              title={integration.label}
              badge={integration.badge}
              status={integration.status}
            >
              {integration.body}
            </IntegrationCard>
          ))}
        </div>
      </section>
    </div>
  );
};
