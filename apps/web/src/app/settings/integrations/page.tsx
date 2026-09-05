import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import type { ZendeskCursor } from "@sla/zendesk";
import { authOptions } from "@/lib/auth";
import { ZendeskConnectForm, ZendeskBackfillButton } from "./zendesk-actions";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const integration = await prisma.integration.findUnique({
    where: {
      organizationId_provider: { organizationId: session.user.organizationId, provider: "zendesk" },
    },
  });
  const cursor = (integration?.cursor as ZendeskCursor | null) ?? null;

  return (
    <main className="settings-page">
      <h1>Integrations</h1>

      <section>
        <h2>Zendesk</h2>
        {integration ? (
          <>
            <p>
              Connected {new Date(integration.connectedAt).toLocaleString()}
              {cursor?.backfillCompletedAt
                ? ` — 90-day backfill complete as of ${new Date(cursor.backfillCompletedAt).toLocaleString()}.`
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
    </main>
  );
}
