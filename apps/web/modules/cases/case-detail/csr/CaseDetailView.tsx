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
  MessageSquare,
  MessageSquareReply,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
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
  nextReplyCycleNumbers,
  NORMALIZED_STATE_DESCRIPTIONS,
} from "@/lib/format";
import {
  LEG_BG_CLASS,
  NORMALIZED_STATE_VARIANT,
  Priority,
  PRIORITY_VARIANT,
} from "@/lib/status-styles";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/types/integrations";
import type { CaseDetailData, TimelineEventDetail } from "@/lib/types/cases";

import { CommitmentCard } from "./CommitmentCard";

const EVENT_TYPE_ICON: Record<string, ReactNode> = {
  case_created: <CirclePlus className="size-3" />,
  state_changed: <ArrowRightLeft className="size-3" />,
  issue_linked: <Link2 className="size-3" />,
  issue_unlinked: <Unlink className="size-3" />,
  case_closed: <CheckCircle2 className="size-3" />,
  agent_replied: <MessageSquareReply className="size-3" />,
  customer_replied: <MessageSquare className="size-3" />,
};

const PROVIDER_LABELS = INTEGRATION_PROVIDER_LABELS as Record<string, string>;

function StateBadge({ state }: { state: string }) {
  return (
    <Badge
      variant={NORMALIZED_STATE_VARIANT[state] ?? "default"}
      className="text-nowrap"
    >
      {formatNormalizedState(state)}
    </Badge>
  );
}

function TimelineEventBody({ event }: { event: TimelineEventDetail }) {
  if (event.type === "state_changed" && event.fromState && event.toState) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
        <StateBadge state={event.fromState} />
        <span className="text-muted-foreground">→</span>
        <StateBadge state={event.toState} />
      </div>
    );
  }

  if (event.type === "case_created" && event.toState) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
        <span>Opened as</span>
        <StateBadge state={event.toState} />
      </div>
    );
  }

  const eventTypeText: Record<string, string> = {
    issue_linked: "Issue linked",
    issue_unlinked: "Issue unlinked",
    case_closed: "Case closed",
    agent_replied: "Agent replied",
    customer_replied: "Customer replied",
  };

  return (
    <span className="text-sm font-medium">
      {eventTypeText[event.type] ?? event.type}
    </span>
  );
}

function TimelineGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What do these states mean?"
          className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
        >
          <HelpCircle className="size-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-full max-w-xs sm:max-w-md lg:max-w-xl"
      >
        <div className="text-xs leading-5 text-muted-foreground">
          These are normalized states used by this app across Zendesk, Jira,
          Linear, and other providers.
        </div>

        <ul className="mt-3 space-y-2.5">
          {Object.entries(NORMALIZED_STATE_DESCRIPTIONS).map(
            ([state, description]) => (
              <li key={state} className="flex items-start gap-2">
                <StateBadge state={state} />
                <span className="text-xs leading-5 text-muted-foreground">
                  {description}
                </span>
              </li>
            ),
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Customer (account/company) and Requester (the individual who submitted
 * the ticket) are distinct concepts and must never be merged: a requester is
 * never shown as if it were the customer. When there's no customer, the
 * requester is labeled explicitly rather than filling the customer's slot
 * unlabeled — that would read as "this is the customer."
 */
export function formatCaseIdentity(customerName: string | null, requesterName: string | null): string {
  if (customerName && requesterName) return `${customerName} · Requester: ${requesterName}`;
  if (customerName) return customerName;
  if (requesterName) return `Requester: ${requesterName}`;
  return "—";
}

function CaseHeader({ data }: { data: CaseDetailData }) {
  const { case: caseData, currentLeg } = data;
  const identity = formatCaseIdentity(caseData.customerName, caseData.requesterName);

  return (
    <Reveal delay={0.05} className="mt-5">
      <div className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="min-w-0 max-w-3xl font-display text-2xl font-medium tracking-tight"
              title={caseData.subject ?? `#${caseData.externalId}`}
            >
              {caseData.subject ?? `${identity} · #${caseData.externalId}`}
            </h1>

            <Badge variant="outline" className="shrink-0">
              {formatLeg(currentLeg)}
            </Badge>
          </div>

          {caseData.subject && (
            <p className="mt-1 text-sm text-muted-foreground">
              {identity} · #{caseData.externalId}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {caseData.priority && (
              <Badge variant={PRIORITY_VARIANT[caseData.priority as Priority]}>
                {caseData.priority}
              </Badge>
            )}

            {caseData.tier && <Badge variant="default">{caseData.tier}</Badge>}

            {caseData.channel && (
              <Badge variant="default">{caseData.channel}</Badge>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Opened {formatDateTime(caseData.openedAt)}
            {caseData.closedAt
              ? ` · Resolved ${formatDateTime(caseData.closedAt)}`
              : ` · Currently in ${formatLeg(currentLeg)}`}
          </p>
        </div>

        {caseData.ticketUrl && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={caseData.ticketUrl} target="_blank" rel="noreferrer">
              Open in {formatTicketSource(caseData.system)}
              <ExternalLink />
            </a>
          </Button>
        )}
      </div>
    </Reveal>
  );
}

function CommitmentSummary({
  data,
  selectedCommitmentId,
}: {
  data: CaseDetailData;
  selectedCommitmentId: string | null;
}) {
  const commitments = selectedCommitmentId
    ? data.commitments.filter(
        (commitment) => commitment.id === selectedCommitmentId,
      )
    : data.commitments;
  // Computed from the case's full commitment list, not the filtered
  // `commitments` above, so a single selected Next Reply card still shows
  // its correct cycle position among all of the case's cycles.
  const cycleNumbers = nextReplyCycleNumbers(data.commitments);
  return (
    <Reveal delay={0.1}>
      {" "}
      {commitments.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No SLA policy has matched this case yet"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {" "}
          {commitments.map((commitment) => (
            <CommitmentCard
              key={commitment.id}
              commitment={commitment}
              cycleNumber={cycleNumbers.get(commitment.id)}
            />
          ))}{" "}
        </div>
      )}{" "}
    </Reveal>
  );
}
function CaseJourney({ data }: { data: CaseDetailData }) {
  const timelineStart = new Date(data.case.openedAt).getTime();
  const timelineEnd = new Date(data.case.closedAt ?? data.asOf).getTime();
  const timelineSpan = Math.max(1, timelineEnd - timelineStart);

  const pct = (iso: string) =>
    ((new Date(iso).getTime() - timelineStart) / timelineSpan) * 100;

  return (
    <Reveal delay={0.15}>
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Layers className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Case journey</CardTitle>
        </CardHeader>

        <CardContent>
          {data.legSpans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No journey data yet.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Stage timeline */}
              <div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-interactive">
                  {data.legSpans.map((span, index) => (
                    <div
                      key={index}
                      className={`h-full ${LEG_BG_CLASS[span.leg]} transition-[filter] hover:brightness-110`}
                      style={{
                        width: `${Math.max(
                          0.5,
                          pct(span.endedAt) - pct(span.startedAt),
                        )}%`,
                      }}
                      title={`${formatLeg(span.leg)} · ${formatDateTime(
                        span.startedAt,
                      )} – ${formatDateTime(span.endedAt)}`}
                    />
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {data.legTotals.map((total) => (
                    <div
                      key={total.leg}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span
                        className={`size-2 rounded-full ${LEG_BG_CLASS[total.leg]}`}
                      />

                      <span>
                        {formatLeg(total.leg)} ·{" "}
                        <span className="tabular-nums text-foreground">
                          {formatMinutes(total.minutes)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLA clock */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">SLA clock</span>

                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-clock-running" />
                      Running
                    </span>

                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-clock-paused" />
                      Paused
                    </span>
                  </div>
                </div>

                <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-interactive">
                  {data.runningIntervals.map((interval, index) => (
                    <div
                      key={`running-${index}`}
                      className="absolute inset-y-0 bg-clock-running"
                      style={{
                        left: `${pct(interval.start)}%`,
                        width: `${Math.max(
                          0.4,
                          pct(interval.end) - pct(interval.start),
                        )}%`,
                      }}
                    />
                  ))}

                  {data.pausedIntervals.map((interval, index) => (
                    <div
                      key={`paused-${index}`}
                      className="absolute inset-y-0 bg-clock-paused"
                      style={{
                        left: `${pct(interval.start)}%`,
                        width: `${Math.max(
                          0.4,
                          pct(interval.end) - pct(interval.start),
                        )}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}

function ActivityTimeline({ data }: { data: CaseDetailData }) {
  return (
    <Reveal delay={0.05}>
      <Card className="min-w-0">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ListTree className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Activity</CardTitle>
          <TimelineGlossary />
        </CardHeader>

        <CardContent>
          {data.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="max-h-128 overflow-y-auto border-t border-border">
              {data.timeline.map((event, index) => (
                <li
                  key={event.id}
                  className="relative py-4 ps-8 first:pt-5 last:pb-1"
                >
                  {index < data.timeline.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-2.5 top-10 w-px bg-border h-full"
                    />
                  )}

                  <span className="absolute left-0 top-5 grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                    {EVENT_TYPE_ICON[event.type] ?? (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  <TimelineEventBody event={event} />

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <time className="tabular-nums">
                      {formatDateTime(event.occurredAt)}
                    </time>

                    <span aria-hidden>·</span>

                    <span>{formatActor(event.actor)}</span>

                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {PROVIDER_LABELS[event.system] ?? event.system}
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}

function formatTicketSource(system: CaseDetailData["case"]["system"]): string {
  return system === "intercom" ? "Intercom" : "Zendesk";
}

function LinkedRecords({ data }: { data: CaseDetailData }) {
  return (
    <Reveal delay={0.05}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked records</CardTitle>
        </CardHeader>

        <CardContent className="max-h-128 overflow-y-auto">
          <ul className="space-y-3">
            {data.case.ticketUrl && (
              <li>
                <a
                  href={data.case.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-md border border-border p-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {formatTicketSource(data.case.system)}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      #{data.case.externalId}
                    </span>
                  </span>

                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </a>
              </li>
            )}

            {data.links.map((link, index) => {
              const provider =
                link.system === "jira"
                  ? "Jira"
                  : link.system === "linear"
                    ? "Linear"
                    : link.system === "github"
                      ? "GitHub"
                      : "Zendesk";

              return (
                <li key={`${link.system}-${link.externalId}-${index}`}>
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block rounded-md border border-border p-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-xs text-muted-foreground">
                            {provider}
                          </span>

                          <span className="block truncate text-sm font-medium">
                            {link.externalId}
                          </span>
                        </div>

                        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {formatCaseLinkMethod(link.method)}
                        </Badge>

                        <Badge variant="outline" className="text-[10px]">
                          {link.confidence}
                        </Badge>

                        {link.statusName && (
                          <Badge variant="outline" className="text-[10px]">
                            {link.statusName}
                          </Badge>
                        )}
                      </div>
                    </a>
                  ) : (
                    <div className="rounded-md border border-border p-2.5">
                      <span className="block text-xs text-muted-foreground">
                        {provider}
                      </span>

                      <span className="block truncate text-sm font-medium">
                        {link.externalId}
                      </span>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {formatCaseLinkMethod(link.method)}
                        </Badge>

                        <Badge variant="outline" className="text-[10px]">
                          {link.confidence}
                        </Badge>

                        {link.statusName && (
                          <Badge variant="secondary" className="text-[10px]">
                            {link.statusName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}

            {!data.case.ticketUrl && data.links.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                No linked records.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </Reveal>
  );
}

/**
 * Keeps the URL's `commitmentId` pointed at the case's active Next Reply
 * cycle (roadmap: Next Reply auto-advance). The page polls via
 * `SlaAutoRefreshProvider`, which re-fetches `data` for the same URL, so a
 * Next Reply cycle that gets superseded (its commitment resolves and a new
 * cycle starts) leaves the currently selected commitment stale. When that
 * happens, replace the URL's `commitmentId` with the cycle that is actually
 * on track — the existing SSR flow then re-renders around it.
 *
 * A selection that isn't a Next Reply commitment (e.g. First Response, or a
 * "Breached cases" link into a superseded cycle) never auto-advances.
 */
function useNextReplyCycleSync(
  commitments: CaseDetailData["commitments"],
  selectedCommitmentId: string | null,
): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = commitments.find((c) => c.id === selectedCommitmentId);
  const activeNextReply = commitments.find(
    (c) => c.kind === "next_reply" && c.status === "on_track",
  );

  const staleCommitmentId =
    selected?.kind === "next_reply" &&
    activeNextReply !== undefined &&
    activeNextReply.id !== selectedCommitmentId
      ? activeNextReply.id
      : null;

  useEffect(() => {
    if (!staleCommitmentId) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("commitmentId", staleCommitmentId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [staleCommitmentId, pathname, router, searchParams]);
}

interface CaseDetailViewProps {
  data: CaseDetailData;
  /** A commitment of this case to highlight (validated by the SSR layer), or null. */
  selectedCommitmentId: string | null;
}

export const CaseDetailView = ({
  data,
  selectedCommitmentId,
}: CaseDetailViewProps) => {
  useNextReplyCycleSync(data.commitments, selectedCommitmentId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>

      <CaseHeader data={data} />

      <div className="mt-6">
        <CommitmentSummary
          data={data}
          selectedCommitmentId={selectedCommitmentId}
        />
      </div>

      <div className="mt-4">
        <CaseJourney data={data} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ActivityTimeline data={data} />
        <LinkedRecords data={data} />
      </div>
    </main>
  );
};
