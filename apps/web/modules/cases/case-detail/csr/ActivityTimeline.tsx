"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  CirclePlus,
  Flag,
  HelpCircle,
  Link2,
  ListTree,
  MessageSquare,
  MessageSquareReply,
  PlayCircle,
  SlidersHorizontal,
  Unlink,
} from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import {
  formatActor,
  formatCommitmentKind,
  formatDateTime,
  formatMinutes,
  formatNormalizedState,
  NORMALIZED_STATE_DESCRIPTIONS,
} from "@/lib/format";
import { NORMALIZED_STATE_VARIANT } from "@/lib/status-styles";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/types/integrations";
import type { CaseDetailData, TimelineEventDetail } from "@/lib/types/cases";

const EVENT_TYPE_ICON: Record<string, ReactNode> = {
  case_created: <CirclePlus className="size-3" />,
  state_changed: <ArrowRightLeft className="size-3" />,
  issue_linked: <Link2 className="size-3" />,
  issue_unlinked: <Unlink className="size-3" />,
  case_closed: <CheckCircle2 className="size-3" />,
  agent_replied: <MessageSquareReply className="size-3" />,
  customer_replied: <MessageSquare className="size-3" />,
  priority_changed: <Flag className="size-3" />,
  policy_changed: <SlidersHorizontal className="size-3" />,
  commitment_started: <PlayCircle className="size-3" />,
  commitment_at_risk: <AlertTriangle className="size-3" />,
  commitment_breached: <AlertTriangle className="size-3" />,
  commitment_met: <CheckCircle2 className="size-3" />,
  commitment_cancelled: <Ban className="size-3" />,
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

/** Display-only label for a synthetic timeline row's commitment (3.2/3.3) — e.g. "Resolution". */
function CommitmentLabel({ event }: { event: TimelineEventDetail }) {
  if (!event.commitmentKind) return null;
  return (
    <span className="text-muted-foreground">
      {" "}
      · {formatCommitmentKind(event.commitmentKind)}
    </span>
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

  // Display-only (E-14/3.1): never fed into SLA matching or the engine.
  if (event.type === "priority_changed") {
    return (
      <span className="text-sm font-medium">
        Priority changed{event.fromState ? ` from ${event.fromState}` : ""}
        {event.toState ? ` to ${event.toState}` : " (unset)"}
      </span>
    );
  }

  if (event.type === "policy_changed") {
    return (
      <span className="text-sm font-medium">
        Policy re-matched
        <CommitmentLabel event={event} />
        {event.previousTargetMinutes !== undefined && event.newTargetMinutes !== undefined && (
          <span className="text-muted-foreground">
            {" "}
            — target {formatMinutes(event.previousTargetMinutes)} →{" "}
            {formatMinutes(event.newTargetMinutes)}
          </span>
        )}
      </span>
    );
  }

  if (event.type === "commitment_started") {
    return (
      <span className="text-sm font-medium">
        Commitment started
        <CommitmentLabel event={event} />
      </span>
    );
  }

  if (event.type === "commitment_at_risk") {
    return (
      <span className="text-sm font-medium">
        At risk{event.thresholdPercent !== undefined ? ` (${event.thresholdPercent}% of target used)` : ""}
        <CommitmentLabel event={event} />
      </span>
    );
  }

  if (event.type === "commitment_breached") {
    return (
      <span className="text-sm font-medium">
        Breached
        <CommitmentLabel event={event} />
      </span>
    );
  }

  if (event.type === "commitment_met") {
    return (
      <span className="text-sm font-medium">
        Met
        <CommitmentLabel event={event} />
      </span>
    );
  }

  if (event.type === "commitment_cancelled") {
    return (
      <span className="text-sm font-medium">
        Commitment cancelled
        <CommitmentLabel event={event} />
      </span>
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="What do these states mean?"
          className="size-auto cursor-help bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground active:bg-transparent"
        >
          <HelpCircle className="size-4" />
        </Button>
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

export function ActivityTimeline({ data }: { data: CaseDetailData }) {
  const lastEvent = data.timeline[data.timeline.length - 1];
  // Keyed off the newest event's id (not just the count) so a poll that
  // replaces the same number of events with different content — or the very
  // first event ever arriving — still re-pins to the bottom.
  const { containerRef, onScroll } = useStickToBottom<HTMLOListElement>(
    lastEvent?.id ?? "",
  );

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
            <ol
              ref={containerRef}
              onScroll={onScroll}
              className="max-h-128 overflow-y-auto border-t border-border"
            >
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
