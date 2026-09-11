"use client";

import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  CirclePlus,
  ExternalLink,
  HelpCircle,
  Inbox,
  Layers,
  Link2,
  ListTree,
  Unlink,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatActor,
  formatCaseLinkMethod,
  formatDateTime,
  formatLeg,
  formatMinutes,
  formatNormalizedState,
  NORMALIZED_STATE_DESCRIPTIONS,
} from "@/lib/format";
import { LEG_BG_CLASS, NORMALIZED_STATE_VARIANT } from "@/lib/status-styles";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/types/integrations";
import type { CaseDetailData, TimelineEventDetail } from "@/lib/types/cases";
import { CommitmentCard } from "./CommitmentCard";
import Link from "next/link";

const EVENT_TYPE_ICON: Record<string, ReactNode> = {
  case_created: <CirclePlus className="size-3" />,
  state_changed: <ArrowRightLeft className="size-3" />,
  issue_linked: <Link2 className="size-3" />,
  issue_unlinked: <Unlink className="size-3" />,
  case_closed: <CheckCircle2 className="size-3" />,
};

function StateBadge({ state }: { state: string }) {
  return (
    <Badge variant={NORMALIZED_STATE_VARIANT[state] ?? "default"}>
      {formatNormalizedState(state)}
    </Badge>
  );
}

/** What actually changed for one timeline row — states rendered as colored badges rather than plain text, since that's the part users find opaque. */
function TimelineEventBody({ event }: { event: TimelineEventDetail }) {
  if (event.type === "state_changed" && event.fromState && event.toState) {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <StateBadge state={event.fromState} />
        <span className="text-muted-foreground">→</span>
        <StateBadge state={event.toState} />
      </div>
    );
  }
  if (event.type === "case_created" && event.toState) {
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        Opened as <StateBadge state={event.toState} />
      </div>
    );
  }
  const EVENT_TYPE_TEXT: Record<string, string> = {
    issue_linked: "Issue linked",
    issue_unlinked: "Issue unlinked",
    case_closed: "Case closed",
  };
  return <>{EVENT_TYPE_TEXT[event.type] ?? event.type}</>;
}

/** Explains the app's own state vocabulary — these are normalized across providers, never a provider's literal status text. */
function TimelineGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What do these states mean?"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <HelpCircle className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-wrap items-baseline gap-1 text-xs text-muted-foreground">
          <span>
            These states are this app&apos;s own vocabulary, normalized across
            providers — e.g. a Zendesk &quot;Pending&quot; and a Jira
            &quot;Waiting on Customer&quot; both show up here as
          </span>
          <StateBadge state="pending_customer" />
          <span>.</span>
        </div>
        <ul className="mt-3 space-y-2">
          {Object.entries(NORMALIZED_STATE_DESCRIPTIONS).map(
            ([state, description]) => (
              <li key={state} className="flex items-start gap-2 text-xs">
                <StateBadge state={state} />
                <span className="text-muted-foreground">{description}</span>
              </li>
            ),
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Link>

      <Reveal delay={0.05}>
        <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              className="font-display text-2xl font-medium tracking-tight min-w-0 max-w-100"
              title={data?.case?.subject ?? `#${data?.case?.externalId}`}
            >
              {data.case.subject ??
                `${data.case.customerName ?? "—"} · #${data.case.externalId}`}
            </h1>
            {data.case.subject && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {data.case.customerName ?? "—"} · #{data.case.externalId}
              </p>
            )}
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
            <TimelineGlossary />
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

                <ol className="mt-4 grid place-content-center max-h-90 space-y-4 overflow-y-auto border-t border-border pl-5 pt-4">
                  {data.timeline.map((e, i) => (
                    <li key={e.id} className="relative">
                      {i < data.timeline.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute -left-5 top-5 -bottom-4 w-px bg-border"
                        />
                      )}
                      <span className="absolute -left-7 top-0.5 grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                        {EVENT_TYPE_ICON[e.type] ?? (
                          <span className="size-1.5 rounded-full bg-current" />
                        )}
                      </span>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <time className="tabular-nums">
                          {formatDateTime(e.occurredAt)}
                        </time>
                        <span aria-hidden>·</span>
                        <span>{formatActor(e.actor)}</span>
                        <Badge variant="outline" className="w-fit">
                          {(
                            INTEGRATION_PROVIDER_LABELS as Record<
                              string,
                              string
                            >
                          )[e.system] ?? e.system}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-foreground">
                        <TimelineEventBody event={e} />
                      </div>
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
                          : link.system === "github"
                            ? "GitHub"
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
                          : link.system === "github"
                            ? "GitHub"
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
