import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getFindingsData } from "@/lib/findings-data";
import { formatMinutes } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FindingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const data = await getFindingsData(prisma, session.user.organizationId);

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <h1>Your findings</h1>
        <a href="/dashboard">Skip to dashboard</a>
      </header>

      {data.totalEscalated === 0 ? (
        <div className="onboarding-step">
          <p>
            No tickets have been escalated to Jira in the last {data.periodDays} days yet. Once Jira is connected
            and issues get linked, findings will appear here automatically — nothing to configure.
          </p>
        </div>
      ) : (
        <div className="onboarding-step">
          <p className="findings-narrative">
            Over the last {data.periodDays} days, <strong>{data.totalEscalated}</strong> ticket
            {data.totalEscalated === 1 ? " was" : "s were"} escalated to Jira.{" "}
            <strong>{data.exceededTarget}</strong> of {data.exceededTarget === 1 ? "it" : "them"} exceeded{" "}
            {data.exceededTarget === 1 ? "its" : "their"} customer resolution target.
            {data.avgEngineeringMinutes !== null && (
              <>
                {" "}
                Escalated tickets spent an average of <strong>{formatMinutes(data.avgEngineeringMinutes)}</strong>{" "}
                waiting to be picked up in Jira.
              </>
            )}
          </p>

          {data.topAccounts.length > 0 && (
            <>
              <h2>Top affected accounts</h2>
              <table className="findings-accounts">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Escalations</th>
                    <th>Exceeded target</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topAccounts.map((row) => (
                    <tr key={row.customerName}>
                      <td>{row.customerName}</td>
                      <td>{row.escalatedCases}</td>
                      <td>{row.breachedCases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="onboarding-actions">
        <a href="/settings/integrations">Confirm SLA policies &amp; connect Slack</a>
        <a href="/dashboard">Go to dashboard →</a>
      </div>
    </main>
  );
}
