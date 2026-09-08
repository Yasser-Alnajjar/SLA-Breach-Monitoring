"use client";

import { ArrowLeft, ExternalLink, Inbox, Layers, ListTree } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCaseLinkMethod,
  formatDateTime,
  formatEventDescription,
  formatLeg,
  formatMinutes,
} from "@/lib/format";
import { LEG_BG_CLASS } from "@/lib/status-styles";
import type { CaseDetailData } from "@/lib/types/cases";
import { CommitmentCard } from "./CommitmentCard";

interface CaseDetailViewProps {
  data: CaseDetailData;
}

export const CaseDetailView = ({ data }: CaseDetailViewProps) => {
  const timelineStart = new Date(data.case.openedAt).getTime();
  const timelineEnd = new Date(data.case.closedAt ?? data.asOf).getTime();
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);
  const pct = (iso: string) =>
    ((new Date(iso).getTime() - timelineStart) / timelineSpan) * 100;

  const legTotalMinutes =
    data.legTotals.reduce((sum, t) => sum + t.minutes, 0) || 1;
  console.log(data);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </a>

      <Reveal delay={0.05}>
        <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">
              {data.case.customerName ?? "—"} · #{data.case.externalId}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[data.case.priority, data.case.tier, data.case.channel]
                .filter(Boolean)
                .join(" · ") || "No priority/tier/channel"}
              {" · "}Opened {formatDateTime(data.case.openedAt)}
              {data.case.closedAt
                ? ` · Resolved ${formatDateTime(data.case.closedAt)}`
                : ` · Currently in ${formatLeg(data.currentLeg)}`}
            </p>
          </div>
          {data.case.zendeskUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={data.case.zendeskUrl} target="_blank" rel="noreferrer">
                Open in Zendesk
                <ExternalLink />
              </a>
            </Button>
          )}
        </header>
      </Reveal>

      <Reveal delay={0.1} className="mt-6">
        {data.commitments.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No SLA policy has matched this case yet"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.commitments.map((c) => (
              <CommitmentCard key={c.id} commitment={c} />
            ))}
          </div>
        )}
      </Reveal>

      <Reveal delay={0.15} className="mt-4">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Layers className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Time by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {data.legTotals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-interactive">
                  {data.legTotals.map((t) => (
                    <div
                      key={t.leg}
                      className={`h-full ${LEG_BG_CLASS[t.leg]} transition-[filter] hover:brightness-110`}
                      style={{
                        width: `${(t.minutes / legTotalMinutes) * 100}%`,
                      }}
                      title={`${formatLeg(t.leg)}: ${formatMinutes(t.minutes)}`}
                    />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {data.legTotals.map((t) => (
                    <li key={t.leg} className="flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full ${LEG_BG_CLASS[t.leg]}`}
                      />
                      {formatLeg(t.leg)} — {formatMinutes(t.minutes)}
                      {t.leg === "engineering" && data.engineeringLegTarget && (
                        <>
                          <StatusBadge
                            status={data.engineeringLegTarget.status}
                          />
                          <span className="text-xs">
                            target{" "}
                            {formatMinutes(
                              data.engineeringLegTarget.targetMinutes,
                            )}
                            {data.engineeringLegTarget.remainingMinutes < 0
                              ? ` · over by ${formatMinutes(data.engineeringLegTarget.breachedByMinutes ?? 0)}`
                              : ` · ${formatMinutes(data.engineeringLegTarget.remainingMinutes)} left`}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.2} className="mt-4">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ListTree className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {data.legSpans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-interactive">
                  {data.legSpans.map((s, i) => (
                    <div
                      key={i}
                      className={`absolute inset-y-0 ${LEG_BG_CLASS[s.leg]}`}
                      style={{
                        left: `${pct(s.startedAt)}%`,
                        width: `${Math.max(0.3, pct(s.endedAt) - pct(s.startedAt))}%`,
                      }}
                      title={`${formatLeg(s.leg)} · ${formatDateTime(s.startedAt)} – ${formatDateTime(s.endedAt)}${s.note ? ` (${s.note})` : ""}`}
                    />
                  ))}
                </div>
                <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-interactive">
                  {data.runningIntervals.map((r, i) => (
                    <div
                      key={`r-${i}`}
                      className="absolute inset-y-0 bg-clock-running"
                      style={{
                        left: `${pct(r.start)}%`,
                        width: `${Math.max(0.3, pct(r.end) - pct(r.start))}%`,
                      }}
                      title={`SLA clock running · ${formatDateTime(r.start)} – ${formatDateTime(r.end)}`}
                    />
                  ))}
                  {data.pausedIntervals.map((p, i) => (
                    <div
                      key={`p-${i}`}
                      className="absolute inset-y-0 bg-clock-paused"
                      style={{
                        left: `${pct(p.start)}%`,
                        width: `${Math.max(0.3, pct(p.end) - pct(p.start))}%`,
                      }}
                      title={`Paused (${p.cause}) · ${formatDateTime(p.start)} – ${formatDateTime(p.end)}`}
                    />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-clock-running" />{" "}
                    SLA clock running
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-clock-paused" />{" "}
                    Paused
                  </span>
                </p>

                <ol className="mt-4 max-h-90 space-y-2 overflow-y-auto border-t border-border pt-3">
                  {data.timeline.map((e) => (
                    <li
                      key={e.id}
                      className="grid grid-cols-[7rem_5rem_5rem_1fr] items-baseline gap-3 text-sm"
                    >
                      <time className="tabular-nums text-xs text-muted-foreground">
                        {formatDateTime(e.occurredAt)}
                      </time>
                      <span className="text-xs text-muted-foreground">
                        {e.actor}
                      </span>
                      <Badge variant="outline" className="w-fit">
                        {e.system}
                      </Badge>
                      <span className="text-foreground">
                        {formatEventDescription(e)}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.25} className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linked records</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.case.zendeskUrl && (
                <li>
                  <a
                    href={data.case.zendeskUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Zendesk #{data.case.externalId}
                    <ExternalLink className="size-3.5" />
                  </a>
                </li>
              )}
              {data.links.length === 0 && !data.case.zendeskUrl && (
                <li className="text-muted-foreground">No linked records.</li>
              )}
              {data.links.map((link, i) => (
                <li key={i} className="text-muted-foreground">
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {link.system === "jira"
                        ? "Jira"
                        : link.system === "linear"
                          ? "Linear"
                          : "Zendesk"}{" "}
                      {link.externalId}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-foreground">
                      {link.system === "jira"
                        ? "Jira"
                        : link.system === "linear"
                          ? "Linear"
                          : "Zendesk"}{" "}
                      {link.externalId}
                    </span>
                  )}
                  {" · "}
                  {formatCaseLinkMethod(link.method)} ({link.confidence})
                  {link.statusName && (
                    <Badge variant="outline" className="ml-2">
                      {link.statusName}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </main>
  );
};
