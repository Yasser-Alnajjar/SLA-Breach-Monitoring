import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatCommitmentKind, formatLeg, formatMinutes } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const data = await getDashboardData(prisma, session.user.organizationId);

  const complianceTrend =
    data.compliance.current !== null && data.compliance.previous !== null
      ? data.compliance.current - data.compliance.previous
      : null;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <a href="/settings/integrations">Integrations</a>
      </header>

      <div className="dashboard-grid">
        <section className="panel panel-at-risk">
          <h2>At risk now</h2>
          {data.atRisk.length === 0 ? (
            <p className="panel-empty">No open commitments.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Ticket</th>
                  <th>Commitment</th>
                  <th>Remaining</th>
                  <th>Leg</th>
                  <th>Time in leg</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((row) => (
                  <tr key={row.commitmentId} className={row.status === "breached" ? "row-breached" : undefined}>
                    <td>{row.customerName ?? "—"}</td>
                    <td>
                      <a href={`/cases/${row.caseId}`}>#{row.externalId}</a>
                    </td>
                    <td>{formatCommitmentKind(row.kind)}</td>
                    <td>
                      {row.remainingMinutes < 0
                        ? `${formatMinutes(-row.remainingMinutes)} overdue`
                        : formatMinutes(row.remainingMinutes)}
                    </td>
                    <td>{formatLeg(row.currentLeg)}</td>
                    <td>{formatMinutes(row.minutesInCurrentLeg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.atRiskOverflowCount > 0 && (
            <p className="panel-note">+{data.atRiskOverflowCount} more open commitment(s) not shown.</p>
          )}
        </section>

        <div className="dashboard-side">
          <section className="panel">
            <h2>Breached — last {data.periodDays} days</h2>
            <p className="panel-metric">{data.breachedThisPeriod.length}</p>
            {data.breachedThisPeriod.length > 0 && (
              <details>
                <summary>Show breached cases</summary>
                <ul className="panel-list">
                  {data.breachedThisPeriod.map((row, i) => (
                    <li key={`${row.caseId}-${row.kind}-${i}`}>
                      {row.customerName ?? "—"} · <a href={`/cases/${row.caseId}`}>#{row.externalId}</a> ·{" "}
                      {formatCommitmentKind(row.kind)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="panel">
            <h2>Aging in engineering</h2>
            {data.agingInEngineering.length === 0 ? (
              <p className="panel-empty">Nothing currently with engineering.</p>
            ) : (
              <ul className="panel-list">
                {data.agingInEngineering.map((row) => (
                  <li key={row.caseId}>
                    {row.customerName ?? "—"} · <a href={`/cases/${row.caseId}`}>#{row.externalId}</a> ·{" "}
                    {formatMinutes(row.minutesInCurrentLeg)}
                  </li>
                ))}
              </ul>
            )}
            {data.agingOverflowCount > 0 && (
              <p className="panel-note">+{data.agingOverflowCount} more.</p>
            )}
          </section>

          <section className="panel">
            <h2>Compliance — last {data.periodDays} days</h2>
            {data.compliance.current === null ? (
              <p className="panel-empty">No commitments closed in this period.</p>
            ) : (
              <p className="panel-metric">
                {data.compliance.current}%
                {complianceTrend !== null && (
                  <span className={complianceTrend >= 0 ? "trend-up" : "trend-down"}>
                    {" "}
                    {complianceTrend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(complianceTrend * 10) / 10)}pp
                  </span>
                )}
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
