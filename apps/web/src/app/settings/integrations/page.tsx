import { GitBranch, MessageSquare, Ticket, Timer, Workflow } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import type { ZendeskCredentials, ZendeskCursor } from "@sla/zendesk";
import type { JiraCursor } from "@sla/jira";
import type { LinearCursor } from "@sla/linear";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { ZendeskConnectForm, ZendeskBackfillButton } from "./zendesk-actions";
import { JiraConnectButton, JiraBackfillButton } from "./jira-actions";
import { LinearConnectButton, LinearBackfillButton } from "./linear-actions";
import { SlackConnectButton, SlackChannelPicker, SlackChannelChangeButton } from "./slack-actions";
import { EngineeringTargetForm } from "./engineering-target-actions";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const [zendeskIntegration, jiraIntegration, linearIntegration, slackIntegration, organization] = await Promise.all([
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId: session.user.organizationId, provider: "zendesk" },
      },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId: session.user.organizationId, provider: "jira" },
      },
    }),
    prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId: session.user.organizationId, provider: "linear" },
      },
    }),
    prisma.slackIntegration.findUnique({
      where: { organizationId: session.user.organizationId },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { engineeringLegTargetMinutes: true },
    }),
  ]);
  const zendeskCursor = (zendeskIntegration?.cursor as ZendeskCursor | null) ?? null;
  const zendeskCredentials = (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;
  const jiraCursor = (jiraIntegration?.cursor as JiraCursor | null) ?? null;
  const linearCursor = (linearIntegration?.cursor as LinearCursor | null) ?? null;

  return (
    <AppShell title="Integrations">
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
              {zendeskIntegration && zendeskCredentials && <Badge variant="success">Connected</Badge>}
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
                  <ZendeskBackfillButton
                    subdomain={zendeskCredentials.subdomain}
                    initialReauthRequired={zendeskCredentials.reauthRequired === true}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no tickets, comments, or fields are ever written back to Zendesk.
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
              {jiraIntegration && <Badge variant="success">Connected</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              {jiraIntegration ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(jiraIntegration.connectedAt).toLocaleString()}
                    {jiraCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(jiraCursor.backfillCompletedAt).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>
                  <JiraBackfillButton />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no issues, comments, or fields are ever written back to Jira.
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
              {linearIntegration && <Badge variant="success">Connected</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              {linearIntegration ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connected {new Date(linearIntegration.connectedAt).toLocaleString()}
                    {linearCursor?.backfillCompletedAt
                      ? ` — 90-day backfill complete as of ${new Date(linearCursor.backfillCompletedAt).toLocaleString()}.`
                      : " — no backfill run yet."}
                  </p>
                  <LinearBackfillButton />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only access — no issues, comments, or fields are ever written back to Linear. An
                    alternative engineering-leg source alongside Jira, not a replacement.
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
              <EngineeringTargetForm initialTargetMinutes={organization?.engineeringLegTargetMinutes ?? null} />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
