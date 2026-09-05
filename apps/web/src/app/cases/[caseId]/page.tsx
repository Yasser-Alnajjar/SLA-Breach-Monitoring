import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getPrismaClient } from "@sla/db";
import { authOptions } from "@/lib/auth";
import { getCaseDetailData, type CommitmentDetail } from "@/lib/case-detail-data";
import {
  formatCaseLinkMethod,
  formatCommitmentKind,
  formatCommitmentStatus,
  formatDateTime,
  formatEventDescription,
  formatLeg,
  formatMinutes,
  formatWeeklyWindow,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const LEG_CLASS: Record<string, string> = {
  support: "leg-support",
  engineering: "leg-engineering",
  waiting_customer: "leg-waiting",
  unknown: "leg-unknown",
};

const STATUS_CLASS: Record<string, string> = {
  on_track: "status-on-track",
  at_risk: "status-at-risk",
  met: "status-met",
  breached: "status-breached",
  cancelled: "status-cancelled",
};

export default async function CaseDetailPage({ params }: { params: { caseId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  const prisma = getPrismaClient();
  const data = await getCaseDetailData(prisma, session.user.organizationId, params.caseId);
  if (!data) notFound();

  const timelineStart = new Date(data.case.openedAt).getTime();
  const timelineEnd = new Date(data.case.closedAt ?? data.asOf).getTime();
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);
  const pct = (iso: string) => ((new Date(iso).getTime() - timelineStart) / timelineSpan) * 100;

  const legTotalMinutes = data.legTotals.reduce((sum, t) => sum + t.minutes, 0) || 1;

  return (
    <main className="case-page">
      <a className="back-link" href="/dashboard">
        ← Dashboard
      </a>

      <header className="case-header">
        <div>
          <h1>
            {data.case.customerName ?? "—"} · #{data.case.externalId}
          </h1>
          <p className="case-meta">
            {[data.case.priority, data.case.tier, data.case.channel].filter(Boolean).join(" · ") ||
              "No priority/tier/channel"}
            {" · "}Opened {formatDateTime(data.case.openedAt)}
            {data.case.closedAt
              ? ` · Closed ${formatDateTime(data.case.closedAt)}`
              : ` · Currently in ${formatLeg(data.currentLeg)}`}
          </p>
        </div>
        {data.case.zendeskUrl && (
          <a className="external-link" href={data.case.zendeskUrl} target="_blank" rel="noreferrer">
            Open in Zendesk ↗
          </a>
        )}
      </header>

      <section className="commitment-cards">
        {data.commitments.length === 0 ? (
          <p className="panel-empty">No SLA policy has matched this case yet.</p>
        ) : (
          data.commitments.map((c) => <CommitmentCard key={c.id} commitment={c} />)
        )}
      </section>

      <section className="panel">
        <h2>Time by stage</h2>
        {data.legTotals.length === 0 ? (
          <p className="panel-empty">No events yet.</p>
        ) : (
          <>
            <div className="stage-bar">
              {data.legTotals.map((t) => (
                <div
                  key={t.leg}
                  className={`stage-segment ${LEG_CLASS[t.leg]}`}
                  style={{ width: `${(t.minutes / legTotalMinutes) * 100}%` }}
                  title={`${formatLeg(t.leg)}: ${formatMinutes(t.minutes)}`}
                />
              ))}
            </div>
            <ul className="stage-legend">
              {data.legTotals.map((t) => (
                <li key={t.leg}>
                  <span className={`legend-swatch ${LEG_CLASS[t.leg]}`} />
                  {formatLeg(t.leg)} — {formatMinutes(t.minutes)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Timeline</h2>
        {data.legSpans.length === 0 ? (
          <p className="panel-empty">No events yet.</p>
        ) : (
          <>
            <div className="timeline-bar leg-bar">
              {data.legSpans.map((s, i) => (
                <div
                  key={i}
                  className={`timeline-segment ${LEG_CLASS[s.leg]}`}
                  style={{
                    left: `${pct(s.startedAt)}%`,
                    width: `${Math.max(0.3, pct(s.endedAt) - pct(s.startedAt))}%`,
                  }}
                  title={`${formatLeg(s.leg)} · ${formatDateTime(s.startedAt)} – ${formatDateTime(s.endedAt)}${s.note ? ` (${s.note})` : ""}`}
                />
              ))}
            </div>
            <div className="timeline-bar clock-bar">
              {data.runningIntervals.map((r, i) => (
                <div
                  key={`r-${i}`}
                  className="timeline-segment clock-running"
                  style={{ left: `${pct(r.start)}%`, width: `${Math.max(0.3, pct(r.end) - pct(r.start))}%` }}
                  title={`SLA clock running · ${formatDateTime(r.start)} – ${formatDateTime(r.end)}`}
                />
              ))}
              {data.pausedIntervals.map((p, i) => (
                <div
                  key={`p-${i}`}
                  className="timeline-segment clock-paused"
                  style={{ left: `${pct(p.start)}%`, width: `${Math.max(0.3, pct(p.end) - pct(p.start))}%` }}
                  title={`Paused (${p.cause}) · ${formatDateTime(p.start)} – ${formatDateTime(p.end)}`}
                />
              ))}
            </div>
            <p className="timeline-legend">
              <span className="legend-swatch clock-running" /> SLA clock running
              <span className="legend-swatch clock-paused" /> Paused
            </p>

            <ol className="event-list">
              {data.timeline.map((e) => (
                <li key={e.id}>
                  <time>{formatDateTime(e.occurredAt)}</time>
                  <span className="event-actor">{e.actor}</span>
                  <span className="event-system">{e.system}</span>
                  <span className="event-desc">{formatEventDescription(e)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Linked records</h2>
        <ul className="panel-list">
          {data.case.zendeskUrl && (
            <li>
              <a href={data.case.zendeskUrl} target="_blank" rel="noreferrer">
                Zendesk #{data.case.externalId} ↗
              </a>
            </li>
          )}
          {data.links.length === 0 && !data.case.zendeskUrl && <li className="panel-empty">No linked records.</li>}
          {data.links.map((link, i) => (
            <li key={i}>
              {link.url ? (
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.system === "jira" ? "Jira" : "Zendesk"} {link.externalId} ↗
                </a>
              ) : (
                <span>
                  {link.system === "jira" ? "Jira" : "Zendesk"} {link.externalId}
                </span>
              )}
              {" · "}
              {formatCaseLinkMethod(link.method)} ({link.confidence})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function CommitmentCard({ commitment }: { commitment: CommitmentDetail }) {
  return (
    <div className={`commitment-card ${STATUS_CLASS[commitment.status]}`}>
      <div className="commitment-card-header">
        <span className="commitment-kind">{formatCommitmentKind(commitment.kind)}</span>
        <span className="commitment-status">{formatCommitmentStatus(commitment.status)}</span>
      </div>
      <p className="commitment-remaining">
        {commitment.status === "breached"
          ? `${formatMinutes(commitment.breachedByMinutes ?? -commitment.remainingMinutes)} over target`
          : commitment.remainingMinutes < 0
            ? `${formatMinutes(-commitment.remainingMinutes)} overdue`
            : `${formatMinutes(commitment.remainingMinutes)} remaining`}
      </p>
      <p className="commitment-meta">
        Target {formatMinutes(commitment.targetMinutes)} · Due {formatDateTime(commitment.dueAt)}
      </p>

      <details className="disclosure">
        <summary>How this was calculated</summary>
        <dl>
          <dt>Policy version</dt>
          <dd>
            v{commitment.policyVersion.version} (effective {formatDateTime(commitment.policyVersion.effectiveFrom)})
          </dd>
          <dt>Match</dt>
          <dd>
            {[
              commitment.policyVersion.match.priority &&
                `priority in [${commitment.policyVersion.match.priority.join(", ")}]`,
              commitment.policyVersion.match.tier && `tier in [${commitment.policyVersion.match.tier.join(", ")}]`,
              commitment.policyVersion.match.customerIds && "customer-specific",
            ]
              .filter(Boolean)
              .join(" · ") || "Any case (default)"}
          </dd>
          <dt>Pauses on</dt>
          <dd>
            {commitment.policyVersion.pauseOnStates.length > 0
              ? commitment.policyVersion.pauseOnStates.join(", ")
              : "Never pauses"}
          </dd>
          <dt>Warn thresholds</dt>
          <dd>{commitment.policyVersion.warnAtPercent.join("%, ")}%</dd>
          <dt>Calendar</dt>
          <dd>
            {commitment.calendar.alwaysOpen ? (
              "Always open (24/7)"
            ) : (
              <>
                {commitment.calendar.timezone}
                {", "}
                {commitment.calendar.weekly.map(formatWeeklyWindow).join(", ")}
                {commitment.calendar.holidays.length > 0 &&
                  ` · Holidays: ${commitment.calendar.holidays.join(", ")}`}
              </>
            )}
          </dd>
        </dl>
      </details>
    </div>
  );
}
