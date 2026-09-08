"use client";

import {
  GitBranch,
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  Ticket,
  Timer,
  Workflow,
} from "lucide-react";
import type { Integration } from "@sla/db";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationsPageData } from "@/lib/types/integrations";
import { ZendeskConnectForm, ZendeskBackfillButton } from "./ZendeskCard";
import { JiraConnectButton, JiraBackfillButton } from "./JiraCard";
import { LinearConnectButton, LinearBackfillButton } from "./LinearCard";
import {
  SlackConnectButton,
  SlackChannelPicker,
  SlackChannelChangeButton,
} from "./SlackCard";
import { EngineeringTargetForm } from "./EngineeringTargetForm";
import { SlaPoliciesCard } from "./SlaPoliciesCard";
import { DisconnectButton } from "./DisconnectButton";

function SyncHealth({
  integration,
}: {
  integration: Pick<Integration, "lastSyncAt" | "lastSyncError">;
}) {
  if (!integration.lastSyncAt) return null;

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Last sync attempt {new Date(integration.lastSyncAt).toLocaleString()}
      {integration.lastSyncError ? (
        <span className="text-destructive"> — {integration.lastSyncError}</span>
      ) : (
        " — succeeded."
      )}
    </p>
  );
}

interface IntegrationsViewProps {
  data: IntegrationsPageData;
}

const iconWrapper =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground";

const descriptionClass = "text-sm leading-6 text-muted-foreground";

/**
 * Reusable backfill operation row.
 * Keeps the backfill action visually secondary.
 */
function BackfillRow({
  children,
  description = "Import the last 90 days of data.",
}: {
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-sm font-medium">Data backfill</p>
          </div>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}

/**
 * Shared card shell for provider integrations.
 */
function IntegrationCard({
  delay,
  icon,
  title,
  status,
  children,
}: {
  delay: number;
  icon: React.ReactNode;
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={iconWrapper}>{icon}</span>

            <CardTitle className="truncate text-sm font-semibold">
              {title}
            </CardTitle>
          </div>

          {status}
        </CardHeader>

        <CardContent className="flex flex-1 flex-col px-5 py-5">
          {children}
        </CardContent>
      </Card>
    </Reveal>
  );
}

export const IntegrationsView = ({ data }: IntegrationsViewProps) => {
  const {
    zendeskIntegration,
    zendeskCursor,
    zendeskCredentials,
    jiraIntegration,
    jiraCursor,
    jiraCredentials,
    linearIntegration,
    linearCursor,
    linearCredentials,
    slackIntegration,
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
            title="Zendesk"
            status={
              zendeskIntegration && zendeskCredentials ? (
                zendeskIntegration.status === "reauth_required" ? (
                  <Badge variant="warning" className="shrink-0">
                    Needs reconnect
                  </Badge>
                ) : (
                  <Badge variant="success" className="shrink-0">
                    Connected
                  </Badge>
                )
              ) : (
                zendeskIntegration?.status === "disconnected" && (
                  <Badge variant="outline" className="shrink-0">
                    Disconnected
                  </Badge>
                )
              )
            }
          >
            {zendeskIntegration && zendeskCredentials ? (
              <div className="flex flex-1 flex-col">
                <div className="space-y-2">
                  <p className={descriptionClass}>
                    Connected{" "}
                    {new Date(zendeskIntegration.connectedAt).toLocaleString()}
                    {zendeskCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(
                          zendeskCursor.backfillCompletedAt,
                        ).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>

                  <SyncHealth integration={zendeskIntegration} />
                </div>

                <div className="mt-auto space-y-3 pt-6">
                  <BackfillRow>
                    <ZendeskBackfillButton
                      subdomain={zendeskCredentials.subdomain}
                      initialReauthRequired={
                        zendeskCredentials.reauthRequired === true
                      }
                    />
                  </BackfillRow>

                  <div className="pt-1">
                    <DisconnectButton
                      provider="zendesk"
                      providerLabel="Zendesk"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className={descriptionClass}>
                  Read-only access — no tickets, comments, or fields are ever
                  written back to Zendesk.
                  {zendeskIntegration?.disconnectedAt &&
                    ` Disconnected ${new Date(
                      zendeskIntegration.disconnectedAt,
                    ).toLocaleString()}.`}
                </p>

                <div className="mt-auto pt-6">
                  <ZendeskConnectForm />
                </div>
              </div>
            )}
          </IntegrationCard>

          {/* Jira */}
          <IntegrationCard
            delay={0.05}
            icon={<GitBranch className="size-4" />}
            title="Jira"
            status={
              jiraIntegration && jiraCredentials ? (
                jiraIntegration.status === "reauth_required" ? (
                  <Badge variant="warning" className="shrink-0">
                    Needs reconnect
                  </Badge>
                ) : (
                  <Badge variant="success" className="shrink-0">
                    Connected
                  </Badge>
                )
              ) : (
                jiraIntegration?.status === "disconnected" && (
                  <Badge variant="outline" className="shrink-0">
                    Disconnected
                  </Badge>
                )
              )
            }
          >
            {jiraIntegration && jiraCredentials ? (
              <div className="flex flex-1 flex-col">
                <div className="space-y-2">
                  <p className={descriptionClass}>
                    Connected{" "}
                    {new Date(jiraIntegration.connectedAt).toLocaleString()}
                    {jiraCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(
                          jiraCursor.backfillCompletedAt,
                        ).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>

                  <SyncHealth integration={jiraIntegration} />
                </div>

                <div className="mt-auto space-y-3 pt-6">
                  <BackfillRow>
                    <JiraBackfillButton
                      initialReauthRequired={
                        jiraCredentials.reauthRequired === true
                      }
                    />
                  </BackfillRow>

                  <div className="pt-1">
                    <DisconnectButton provider="jira" providerLabel="Jira" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className={descriptionClass}>
                  Read-only access — no issues, comments, or fields are ever
                  written back to Jira.
                  {jiraIntegration?.disconnectedAt &&
                    ` Disconnected ${new Date(
                      jiraIntegration.disconnectedAt,
                    ).toLocaleString()}.`}
                </p>

                <div className="mt-auto pt-6">
                  <JiraConnectButton />
                </div>
              </div>
            )}
          </IntegrationCard>

          {/* Linear */}
          <IntegrationCard
            delay={0.1}
            icon={<Workflow className="size-4" />}
            title="Linear"
            status={
              linearIntegration && linearCredentials ? (
                linearIntegration.status === "reauth_required" ? (
                  <Badge variant="warning" className="shrink-0">
                    Needs reconnect
                  </Badge>
                ) : (
                  <Badge variant="success" className="shrink-0">
                    Connected
                  </Badge>
                )
              ) : (
                linearIntegration?.status === "disconnected" && (
                  <Badge variant="outline" className="shrink-0">
                    Disconnected
                  </Badge>
                )
              )
            }
          >
            {linearIntegration && linearCredentials ? (
              <div className="flex flex-1 flex-col">
                <div className="space-y-2">
                  <p className={descriptionClass}>
                    Connected{" "}
                    {new Date(linearIntegration.connectedAt).toLocaleString()}
                    {linearCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(
                          linearCursor.backfillCompletedAt,
                        ).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>

                  <SyncHealth integration={linearIntegration} />
                </div>

                <div className="mt-auto space-y-3 pt-6">
                  <BackfillRow>
                    <LinearBackfillButton
                      initialReauthRequired={
                        linearCredentials.reauthRequired === true
                      }
                    />
                  </BackfillRow>

                  <div className="pt-1">
                    <DisconnectButton
                      provider="linear"
                      providerLabel="Linear"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className={descriptionClass}>
                  Read-only access — no issues, comments, or fields are ever
                  written back to Linear. An alternative engineering-leg source
                  alongside Jira, not a replacement.
                  {linearIntegration?.disconnectedAt &&
                    ` Disconnected ${new Date(
                      linearIntegration.disconnectedAt,
                    ).toLocaleString()}.`}
                </p>

                <div className="mt-auto pt-6">
                  <LinearConnectButton />
                </div>
              </div>
            )}
          </IntegrationCard>

          {/* Slack */}
          <IntegrationCard
            delay={0.15}
            icon={<MessageSquare className="size-4" />}
            title="Slack"
            status={
              slackIntegration && (
                <Badge variant="success" className="shrink-0">
                  Connected
                </Badge>
              )
            }
          >
            {slackIntegration ? (
              <div className="flex flex-1 flex-col">
                <div className="space-y-3">
                  <p className={descriptionClass}>
                    Connected to {slackIntegration.teamName}{" "}
                    {new Date(slackIntegration.installedAt).toLocaleString()}.
                  </p>

                  {slackIntegration.channelId && (
                    <p className={descriptionClass}>
                      At-risk and breach alerts post to #
                      {slackIntegration.channelName}.
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-6">
                  {slackIntegration.channelId ? (
                    <SlackChannelChangeButton />
                  ) : (
                    <SlackChannelPicker />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className={descriptionClass}>
                  The only alert channel in v1. Posts when a commitment crosses
                  a warning threshold or breaches.
                </p>

                <div className="mt-auto pt-6">
                  <SlackConnectButton />
                </div>
              </div>
            )}
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
