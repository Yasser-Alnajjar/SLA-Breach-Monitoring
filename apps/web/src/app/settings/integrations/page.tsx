import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import type { ZendeskCursor } from "@sla/zendesk";
import type { JiraCursor } from "@sla/jira";
import { authOptions } from "@/lib/auth";
import { ZendeskConnectForm, ZendeskBackfillButton } from "./zendesk-actions";
import { JiraConnectButton, JiraBackfillButton } from "./jira-actions";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const [zendeskIntegration, jiraIntegration] = await Promise.all([
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
  ]);
  const zendeskCursor = (zendeskIntegration?.cursor as ZendeskCursor | null) ?? null;
  const jiraCursor = (jiraIntegration?.cursor as JiraCursor | null) ?? null;

  return (
    <main className="settings-page">
      <h1>Integrations</h1>

      <section>
        <h2>Zendesk</h2>
        {zendeskIntegration ? (
          <>
            <p>
              Connected {new Date(zendeskIntegration.connectedAt).toLocaleString()}
              {zendeskCursor?.backfillCompletedAt
                ? ` — 90-day backfill complete as of ${new Date(zendeskCursor.backfillCompletedAt).toLocaleString()}.`
                : " — no backfill run yet."}
            </p>
            <ZendeskBackfillButton />
          </>
        ) : (
          <>
            <p>Read-only access — no tickets, comments, or fields are ever written back to Zendesk.</p>
            <ZendeskConnectForm />
          </>
        )}
      </section>

      <section>
        <h2>Jira</h2>
        {jiraIntegration ? (
          <>
            <p>
              Connected {new Date(jiraIntegration.connectedAt).toLocaleString()}
              {jiraCursor?.backfillCompletedAt
                ? ` — 90-day backfill complete as of ${new Date(jiraCursor.backfillCompletedAt).toLocaleString()}.`
                : " — no backfill run yet."}
            </p>
            <JiraBackfillButton />
          </>
        ) : (
          <>
            <p>Read-only access — no issues, comments, or fields are ever written back to Jira.</p>
            <JiraConnectButton />
          </>
        )}
      </section>
    </main>
  );
}
