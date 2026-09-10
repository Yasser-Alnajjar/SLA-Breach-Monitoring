"use client";

import {
  ChevronRight,
  GitBranch,
  MessageSquare,
  SlidersHorizontal,
  Ticket,
  Timer,
  Workflow,
} from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IntegrationsPageData } from "@/lib/types/integrations";
import { ZendeskConnectForm } from "./ZendeskCard";
import { JiraConnectButton } from "./JiraCard";
import { LinearConnectButton } from "./LinearCard";
import {
  SlackConnectButton,
  SlackChannelPicker,
  SlackChannelChangeButton,
} from "./SlackCard";
import { EngineeringTargetForm } from "./EngineeringTargetForm";
import { SlaPoliciesCard } from "./SlaPoliciesCard";
import { DisconnectButton } from "./DisconnectButton";
import { IntegrationConfigGate } from "./IntegrationConfigGate";

interface IntegrationsViewProps {
  data: IntegrationsPageData;
}

const iconWrapper =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground";

const descriptionClass = "text-sm leading-6 text-muted-foreground";

const providerToneClasses = {
  success: "bg-success/10 text-success",
  primary: "bg-primary/10 text-primary",
  engineering: "bg-leg-engineering/10 text-leg-engineering",
  secondary: "bg-secondary/15 text-secondary",
} as const;

type ProviderTone = keyof typeof providerToneClasses;

const statusToneClasses = {
  success: { dot: "bg-success", text: "text-success" },
  warning: { dot: "bg-warning", text: "text-warning" },
  muted: { dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
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
    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
      <span className={cn("size-1.5 rounded-full", dot)} />
      <span className={text}>{label}</span>
    </span>
  );
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
  tone,
  title,
  status,
  children,
}: {
  delay: number;
  icon: React.ReactNode;
  tone: ProviderTone;
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="flex h-full flex-col gap-5 p-6 transition-shadow duration-300 hover:shadow-elevated">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                providerToneClasses[tone],
              )}
            >
              {icon}
            </span>

            <CardTitle className="truncate text-base font-medium">
              {title}
            </CardTitle>
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
  disconnectHint,
}: {
  provider: "zendesk" | "jira" | "linear";
  providerLabel: string;
  connectedAt: Date;
  disconnectHint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <p className={descriptionClass}>
        Connected {formatDateTime(connectedAt)}.
        {disconnectHint && ` ${disconnectHint}`}
      </p>

      <div className="mt-auto pt-6 flex items-center gap-2">
        <DisconnectButton provider={provider} providerLabel={providerLabel} />
        <Button variant="outline" className="text-nowrap" size="sm" asChild>
          <a href={`/settings/integrations/${provider}`}>
            Manage
            <ChevronRight className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}

export const IntegrationsView = ({ data }: IntegrationsViewProps) => {
  const {
    zendesk,
    zendeskConfig,
    jira,
    jiraConfig,
    // linear,
    // linearConfig,
    slack,
    slackConfig,
    engineeringLegTargetMinutes,
    slaPolicies,
  } = data;

  return (
    <div className="space-y-8">
      {/* Integrations */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect your support, engineering, and alerting systems.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {/* Zendesk */}
          <IntegrationCard
            delay={0}
            icon={<Ticket className="size-4" />}
            tone="success"
            title="Zendesk"
            status={
              zendeskConfig.configured &&
              (zendesk.connected ? (
                zendesk.reauthRequired ? (
                  <StatusIndicator tone="warning" label="Needs reconnect" />
                ) : (
                  <StatusIndicator tone="success" label="Connected" />
                )
              ) : (
                zendesk.disconnectedAt && (
                  <StatusIndicator tone="muted" label="Disconnected" />
                )
              ))
            }
          >
            <IntegrationConfigGate
              provider="zendesk"
              providerLabel="Zendesk"
              config={zendeskConfig}
              descriptionClass={descriptionClass}
            >
              {zendesk.connected ? (
                <ConnectedCardBody
                  provider="zendesk"
                  providerLabel="Zendesk"
                  connectedAt={zendesk.connectedAt!}
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
          </IntegrationCard>

          {/* Jira */}
          <IntegrationCard
            delay={0.05}
            icon={<GitBranch className="size-4" />}
            tone="primary"
            title="Jira"
            status={
              jiraConfig.configured &&
              (jira.connected ? (
                jira.reauthRequired ? (
                  <StatusIndicator tone="warning" label="Needs reconnect" />
                ) : (
                  <StatusIndicator tone="success" label="Connected" />
                )
              ) : (
                jira.disconnectedAt && (
                  <StatusIndicator tone="muted" label="Disconnected" />
                )
              ))
            }
          >
            <IntegrationConfigGate
              provider="jira"
              providerLabel="Jira"
              config={jiraConfig}
              descriptionClass={descriptionClass}
            >
              {jira.connected ? (
                <ConnectedCardBody
                  provider="jira"
                  providerLabel="Jira"
                  connectedAt={jira.connectedAt!}
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
          </IntegrationCard>

          {/* Linear  this is disabled for now */}
          {/* <IntegrationCard
            delay={0.1}
            icon={<Workflow className="size-4" />}
            tone="engineering"
            title="Linear"
            status={
              linear.connected ? (
                linear.reauthRequired ? (
                  <StatusIndicator tone="warning" label="Needs reconnect" />
                ) : (
                  <StatusIndicator tone="success" label="Connected" />
                )
              ) : (
                linear.disconnectedAt && (
                  <StatusIndicator tone="muted" label="Disconnected" />
                )
              )
            }
          >
            <IntegrationConfigGate
              provider="linear"
              providerLabel="Linear"
              config={linearConfig}
              descriptionClass={descriptionClass}
            >
              {linear.connected ? (
                <ConnectedCardBody
                  provider="linear"
                  providerLabel="Linear"
                  connectedAt={linear.connectedAt!}
                />
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className={descriptionClass}>
                    Read-only access — no issues, comments, or fields are ever
                    written back to Linear. An alternative engineering-leg
                    source alongside Jira, not a replacement.
                    {linear.disconnectedAt &&
                      ` Disconnected ${formatDateTime(linear.disconnectedAt)}.`}
                  </p>

                  <div className="mt-auto pt-6">
                    <LinearConnectButton />
                  </div>
                </div>
              )}
            </IntegrationConfigGate>
          </IntegrationCard> */}

          {/* Slack */}
          <IntegrationCard
            delay={0.15}
            icon={<MessageSquare className="size-4" />}
            tone="secondary"
            title="Slack"
            status={
              slackConfig.configured &&
              slack.connected && (
                <StatusIndicator tone="success" label="Connected" />
              )
            }
          >
            <IntegrationConfigGate
              provider="slack"
              providerLabel="Slack"
              config={slackConfig}
              descriptionClass={descriptionClass}
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

                  <div className="mt-auto pt-6">
                    {slack.channelId ? (
                      <SlackChannelChangeButton />
                    ) : (
                      <SlackChannelPicker />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className={descriptionClass}>
                    The only alert channel in v1. Posts when a commitment
                    crosses a warning threshold or breaches.
                  </p>

                  <div className="mt-auto pt-6">
                    <SlackConnectButton />
                  </div>
                </div>
              )}
            </IntegrationConfigGate>
          </IntegrationCard>
        </div>
      </section>

      {/* Configuration */}

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure engineering targets and SLA behavior.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Engineering target */}
          <Reveal delay={0.2}>
            <Card className="h-full overflow-hidden">
              <CardHeader className="border-b bg-muted/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={iconWrapper}>
                    <Timer className="size-4" />
                  </span>

                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Engineering leg target
                    </CardTitle>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Team-wide engineering response target
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 px-5 py-5">
                <p className={descriptionClass}>
                  Optional. When set, a case sitting in the engineering leg past
                  this duration shows as at-risk or breached — not a policy
                  builder, just one target for the whole team.
                </p>

                <EngineeringTargetForm
                  initialTargetMinutes={engineeringLegTargetMinutes}
                />
              </CardContent>
            </Card>
          </Reveal>

          {/* SLA policies */}
          <Reveal delay={0.25}>
            <Card className="h-full overflow-hidden">
              <CardHeader className="border-b bg-muted/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={iconWrapper}>
                    <SlidersHorizontal className="size-4" />
                  </span>

                  <div>
                    <CardTitle className="text-sm font-semibold">
                      SLA policy overrides
                    </CardTitle>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Override targets for matched policies
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 px-5 py-5">
                <p className={descriptionClass}>
                  Manually adjust a matched policy&apos;s targets. This creates
                  a new policy version — existing commitments keep the version
                  they were created under, only new cases pick up the override.
                </p>

                <SlaPoliciesCard policies={slaPolicies} />
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>
    </div>
  );
};
