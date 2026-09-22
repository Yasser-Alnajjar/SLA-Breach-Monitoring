"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Layers } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, formatLeg, formatMinutes } from "@/lib/format";
import { LEG_BG_CLASS } from "@/lib/status-styles";
import type { CaseDetailData } from "@/lib/types/cases";
import { cn } from "@/lib/utils";

function formatLiveDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function toMs(value: string | number | Date | null | undefined): number | null {
  if (value == null) return null;

  const ms = new Date(value).getTime();

  return Number.isFinite(ms) ? ms : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function segmentStyle(
  start: number,
  end: number,
  domainStart: number,
  domainSpan: number,
  minWidthPct = 0.5,
): CSSProperties {
  const left = clamp(((start - domainStart) / domainSpan) * 100, 0, 100);

  const right = clamp(((end - domainStart) / domainSpan) * 100, 0, 100);

  return {
    left: `${left}%`,
    width: `${Math.min(100 - left, Math.max(minWidthPct, right - left))}%`,
  };
}

function useNow(enabled: boolean, fallback: number) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled]);

  return now ?? fallback;
}

export function CaseJourney({ data }: { data: CaseDetailData }) {
  const isOpen = !data.case.closedAt;

  const openedAt = toMs(data.case.openedAt) ?? 0;
  const closedAt = toMs(data.case.closedAt);
  const snapshotAt = toMs(data.asOf) ?? openedAt;

  const now = useNow(isOpen, snapshotAt);

  /*
   * Normalize and sort the stage spans.
   */
  const legSegments = useMemo(
    () =>
      data.legSpans
        .flatMap((span) => {
          const start = toMs(span.startedAt);

          if (start === null) return [];

          return [
            {
              span,
              start,
              end: toMs(span.endedAt),
            },
          ];
        })
        .sort((a, b) => a.start - b.start),
    [data.legSpans],
  );

  /*
   * Find the actual current stage.
   *
   * We use currentLeg from the API instead of assuming that
   * the last array element is always the active stage.
   */
  const currentStageIndex = useMemo(() => {
    if (!isOpen) return -1;

    for (let index = legSegments.length - 1; index >= 0; index--) {
      if (legSegments[index]?.span.leg === data.currentLeg) {
        return index;
      }
    }

    return -1;
  }, [data.currentLeg, isOpen, legSegments]);

  /*
   * The timeline must cover:
   * - openedAt
   * - every stored segment
   * - every SLA interval
   * - now for an open case
   */
  const latestStoredEnd = useMemo(() => {
    return Math.max(
      openedAt,

      ...legSegments.map((segment) => segment.end ?? segment.start),

      ...data.runningIntervals.map((interval) => toMs(interval.end) ?? 0),

      ...data.pausedIntervals.map((interval) => toMs(interval.end) ?? 0),
    );
  }, [openedAt, legSegments, data.runningIntervals, data.pausedIntervals]);

  const timelineEnd = isOpen
    ? Math.max(now, latestStoredEnd)
    : Math.max(closedAt ?? latestStoredEnd, latestStoredEnd);

  const timelineSpan = Math.max(1, timelineEnd - openedAt);

  /*
   * Live per-leg totals.
   *
   * data.legTotals is computed server-side up to the snapshot (asOf), so
   * the current stage's bucket is stale as soon as time passes. Extend
   * just that bucket by the time elapsed since the snapshot.
   */
  const liveLegTotals = useMemo(() => {
    if (!isOpen || currentStageIndex < 0) return data.legTotals;

    const currentLegName = legSegments[currentStageIndex]?.span.leg;
    const extraMinutes = Math.max(0, (now - snapshotAt) / 60_000);

    return data.legTotals.map((total) =>
      total.leg === currentLegName
        ? { ...total, minutes: total.minutes + extraMinutes }
        : total,
    );
  }, [data.legTotals, isOpen, currentStageIndex, legSegments, now, snapshotAt]);

  /*
   * Live SLA elapsed time.
   *
   * If the current running interval is still open, extend it to now.
   */
  const liveSlaSeconds = useMemo(() => {
    return data.runningIntervals.reduce((total, interval, index) => {
      const start = toMs(interval.start);

      if (start === null) return total;

      const storedEnd = toMs(interval.end);

      const isLastInterval = index === data.runningIntervals.length - 1;

      const end =
        isOpen && isLastInterval
          ? Math.max(storedEnd ?? now, now)
          : (storedEnd ?? start);

      if (end <= start) return total;

      return total + (end - start) / 1000;
    }, 0);
  }, [data.runningIntervals, isOpen, now]);

  return (
    <Reveal delay={0.15}>
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Layers className="size-4 text-muted-foreground" />

          <CardTitle className="text-base">Case journey</CardTitle>
        </CardHeader>

        <CardContent>
          {legSegments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No journey data yet.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Stage timeline */}
              <div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-interactive">
                  {legSegments.map(({ span, start, end }, index) => {
                    /*
                     * This is the important part:
                     *
                     * The active stage is determined by currentLeg,
                     * not simply by array position.
                     */
                    const isCurrentStage =
                      isOpen && index === currentStageIndex;

                    /*
                     * For the current stage, the backend's endedAt
                     * is only the last snapshot. The stage is still
                     * running, so visually extend it to now.
                     */
                    const visualEnd = isCurrentStage
                      ? Math.max(end ?? now, now)
                      : (end ?? start);

                    return (
                      <Tooltip key={`${span.leg}-${span.startedAt}-${index}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute inset-y-0 transition-[filter] hover:brightness-110",
                              LEG_BG_CLASS[span.leg] ?? "bg-muted-foreground",
                            )}
                            style={segmentStyle(
                              start,
                              visualEnd,
                              openedAt,
                              timelineSpan,
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {`${formatLeg(span.leg)} · ${formatDateTime(
                            span.startedAt,
                          )} – ${
                            isCurrentStage
                              ? "Now"
                              : end !== null
                                ? formatDateTime(span.endedAt)
                                : "Now"
                          }`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {liveLegTotals.map((total) => (
                    <div
                      key={total.leg}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          LEG_BG_CLASS[total.leg] ?? "bg-muted-foreground",
                        )}
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium">SLA clock</span>

                    <span className="font-mono tabular-nums text-foreground">
                      {formatLiveDuration(liveSlaSeconds)}
                    </span>
                  </div>

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
                  {data.runningIntervals.map((interval, index) => {
                    const start = toMs(interval.start);

                    if (start === null) return null;

                    const storedEnd = toMs(interval.end);

                    const isLast = index === data.runningIntervals.length - 1;

                    const visualEnd =
                      isOpen && isLast
                        ? Math.max(storedEnd ?? now, now)
                        : (storedEnd ?? start);

                    return (
                      <div
                        key={`running-${index}`}
                        className="absolute inset-y-0 bg-clock-running"
                        style={segmentStyle(
                          start,
                          visualEnd,
                          openedAt,
                          timelineSpan,
                          0.4,
                        )}
                      />
                    );
                  })}

                  {data.pausedIntervals.map((interval, index) => {
                    const start = toMs(interval.start);
                    const storedEnd = toMs(interval.end);

                    if (start === null) return null;

                    /*
                     * The case is currently waiting_customer,
                     * therefore the latest paused interval is
                     * still active and must continue to now.
                     */
                    const isLast = index === data.pausedIntervals.length - 1;

                    const isCurrentPause =
                      isOpen &&
                      isLast &&
                      data.currentLeg === "waiting_customer";

                    const visualEnd = isCurrentPause
                      ? Math.max(storedEnd ?? now, now)
                      : (storedEnd ?? start);

                    return (
                      <div
                        key={`paused-${index}`}
                        className="absolute inset-y-0 bg-clock-paused"
                        style={segmentStyle(
                          start,
                          visualEnd,
                          openedAt,
                          timelineSpan,
                          0.4,
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}
