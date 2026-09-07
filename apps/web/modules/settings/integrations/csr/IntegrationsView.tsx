"use client";

import { GitBranch, MessageSquare, Ticket, Timer, Workflow } from "lucide-react";
import type { Integration } from "@sla/db";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationsPageData } from "@/lib/types/integrations";
import { ZendeskConnectForm, ZendeskBackfillButton } from "./ZendeskCard";
import { JiraConnectButton, JiraBackfillButton } from "./JiraCard";
import { LinearConnectButton, LinearBackfillButton } from "./LinearCard";
import { SlackConnectButton, SlackChannelPicker, SlackChannelChangeButton } from "./SlackCard";
import { EngineeringTargetForm } from "./EngineeringTargetForm";
import { DisconnectButton } from "./DisconnectButton";

/** Sync-health line shown under a connected provider's status text (roadmap step 17). */
function SyncHealth({ integration }: { integration: Pick<Integration, "lastSyncAt" | "lastSyncError"> }) {
  if (!integration.lastSyncAt) return null;
  return (
    <p className="text-sm text-muted-foreground">
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
  } = data;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
        <Reveal delay={0}>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-md bg-interactive text-muted-foreground">
                  <Ticket className="size-4" />
                </span>
                <CardTitle>Zendesk</CardTitle>
              </div>
              {zendeskIntegration && zendeskCredentials ? (
                zendeskIntegration.status === "reauth_required" ? (
                  <Badge variant="warning">Needs reconnect</Badge>
                ) : (
                  <Badge variant="success">Connected</Badge>
                )
              ) : (
                zendeskIntegration?.status === "disconnected" && <Badge variant="outline">Disconnected</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {zendeskIntegration && zendeskCredentials ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(zendeskIntegration.connectedAt).toLocaleString()}
                    {zendeskCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(zendeskCursor.backfillCompletedAt).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>
                  <SyncHealth integration={zendeskIntegration} />
                  <ZendeskBackfillButton
                    subdomain={zendeskCredentials.subdomain}
                    initialReauthRequired={zendeskCredentials.reauthRequired === true}
                  />
                  <DisconnectButton provider="zendesk" providerLabel="Zendesk" />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no tickets, comments, or fields are ever written back to Zendesk.
                    {zendeskIntegration?.disconnectedAt &&
                      ` Disconnected ${new Date(zendeskIntegration.disconnectedAt).toLocaleString()}.`}
                  </p>
                  <ZendeskConnectForm />
                </>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-md bg-interactive text-muted-foreground">
                  <GitBranch className="size-4" />
                </span>
                <CardTitle>Jira</CardTitle>
              </div>
              {jiraIntegration && jiraCredentials ? (
                jiraIntegration.status === "reauth_required" ? (
                  <Badge variant="warning">Needs reconnect</Badge>
                ) : (
                  <Badge variant="success">Connected</Badge>
                )
              ) : (
                jiraIntegration?.status === "disconnected" && <Badge variant="outline">Disconnected</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {jiraIntegration && jiraCredentials ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(jiraIntegration.connectedAt).toLocaleString()}
                    {jiraCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(jiraCursor.backfillCompletedAt).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>
                  <SyncHealth integration={jiraIntegration} />
                  <JiraBackfillButton initialReauthRequired={jiraCredentials.reauthRequired === true} />
                  <DisconnectButton provider="jira" providerLabel="Jira" />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no issues, comments, or fields are ever written back to Jira.
                    {jiraIntegration?.disconnectedAt &&
                      ` Disconnected ${new Date(jiraIntegration.disconnectedAt).toLocaleString()}.`}
                  </p>
                  <JiraConnectButton />
                </>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-md bg-interactive text-muted-foreground">
                  <Workflow className="size-4" />
                </span>
                <CardTitle>Linear</CardTitle>
              </div>
              {linearIntegration && linearCredentials ? (
                linearIntegration.status === "reauth_required" ? (
                  <Badge variant="warning">Needs reconnect</Badge>
                ) : (
                  <Badge variant="success">Connected</Badge>
                )
              ) : (
                linearIntegration?.status === "disconnected" && <Badge variant="outline">Disconnected</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {linearIntegration && linearCredentials ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(linearIntegration.connectedAt).toLocaleString()}
                    {linearCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(linearCursor.backfillCompletedAt).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>
                  <SyncHealth integration={linearIntegration} />
                  <LinearBackfillButton initialReauthRequired={linearCredentials.reauthRequired === true} />
                  <DisconnectButton provider="linear" providerLabel="Linear" />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no issues, comments, or fields are ever written back to Linear. An
                    alternative engineering-leg source alongside Jira, not a replacement.
                    {linearIntegration?.disconnectedAt &&
                      ` Disconnected ${new Date(linearIntegration.disconnectedAt).toLocaleString()}.`}
                  </p>
                  <LinearConnectButton />
                </>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-md bg-interactive text-muted-foreground">
                  <MessageSquare className="size-4" />
                </span>
                <CardTitle>Slack</CardTitle>
              </div>
              {slackIntegration && <Badge variant="success">Connected</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              {slackIntegration ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected to {slackIntegration.teamName} {new Date(slackIntegration.installedAt).toLocaleString()}.
                  </p>
                  {slackIntegration.channelId ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        At-risk and breach alerts post to #{slackIntegration.channelName}.
                      </p>
                      <SlackChannelChangeButton />
                    </>
                  ) : (
                    <SlackChannelPicker />
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    The only alert channel in v1. Posts when a commitment crosses a warning threshold or breaches.
                  </p>
                  <SlackConnectButton />
                </>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.2}>
          <Card>
            <CardHeader className="flex-row items-center gap-2.5 space-y-0">
              <span className="flex size-9 items-center justify-center rounded-md bg-interactive text-muted-foreground">
                <Timer className="size-4" />
              </span>
              <CardTitle>Engineering leg target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Optional. When set, a case sitting in the engineering leg past this duration shows as at-risk or
                breached — not a policy builder, just one target for the whole team.
              </p>
              <EngineeringTargetForm initialTargetMinutes={engineeringLegTargetMinutes} />
            </CardContent>
          </Card>
        </Reveal>
      </div>
  );
};

