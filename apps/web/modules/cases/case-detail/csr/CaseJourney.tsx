"use client";

import { Layers } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatLeg, formatMinutes } from "@/lib/format";
import { LEG_BG_CLASS } from "@/lib/status-styles";
import type { CaseDetailData } from "@/lib/types/cases";

export function CaseJourney({ data }: { data: CaseDetailData }) {
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
