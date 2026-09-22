"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCommitmentDeadline,
  formatCommitmentKind,
  formatDateTimeWithOffset,
  formatMinutes,
  formatPolicyMatch,
  formatSeconds,
  formatWeeklyWindow,
} from "@/lib/format";
import { STATUS_BORDER_CLASS } from "@/lib/status-styles";
import type { CommitmentDetail } from "@/lib/types/cases";

const getLiveRemainingSeconds = (commitment: CommitmentDetail): number => {
  if (commitment.clockState !== "running" || !commitment.effectiveDueAt) {
    return commitment.remainingSeconds;
  }

  const dueAt = new Date(commitment.effectiveDueAt).getTime();
  const now = Date.now();

  return Math.floor((dueAt - now) / 1000);
};

export const CommitmentCard = ({
  commitment,
  cycleNumber,
}: {
  commitment: CommitmentDetail;
  /** This commitment's 1-based Next Reply cycle position (`nextReplyCycleNumbers`), when it has one — presentation-only, never the engine's `cycleKey`. */
  cycleNumber?: number;
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => commitment.remainingSeconds,
  );

  useEffect(() => {
    const update = () => {
      setRemainingSeconds(getLiveRemainingSeconds(commitment));
    };

    // First update happens after hydration.
    update();

    if (commitment.clockState !== "running" || !commitment.effectiveDueAt) {
      return;
    }

    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [
    commitment.effectiveDueAt,
    commitment.clockState,
    commitment.remainingSeconds,
  ]);

  const counterText =
    commitment.status === "breached"
      ? `${formatSeconds(Math.max(0, -remainingSeconds))} over target`
      : remainingSeconds < 0
        ? `${formatSeconds(-remainingSeconds)} overdue`
        : `${formatSeconds(remainingSeconds)} remaining`;

  return (
    <Card className={`border-l-4 ${STATUS_BORDER_CLASS[commitment.status]}`}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {formatCommitmentKind(commitment.kind)}
            {cycleNumber !== undefined && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                · Cycle {cycleNumber}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {commitment.clockState !== "stopped" && (
              <Badge variant="outline" className="text-nowrap">
                <span
                  className={`size-2 rounded-full ${
                    commitment.clockState === "paused"
                      ? "bg-clock-paused"
                      : "bg-clock-running"
                  }`}
                />
                {commitment.clockState === "paused" ? "Paused" : "Running"}
              </Badge>
            )}

            <StatusBadge status={commitment.status} />
          </div>
        </div>

        <p className="mt-2 font-display text-2xl font-medium tracking-tight tabular-nums">
          {counterText}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {formatCommitmentDeadline(commitment)}
        </p>

        <Accordion type="single" collapsible className="mt-3">
          <AccordionItem value="calculation" className="border-b-0">
            <AccordionTrigger className="cursor-pointer items-center justify-start gap-1 py-0 text-xs text-muted-foreground transition-colors hover:text-foreground hover:no-underline [&>svg]:size-3.5 [&>svg]:translate-y-0 [&>svg]:text-current [&>svg]:duration-150">
              How this was calculated
            </AccordionTrigger>

            <AccordionContent className="pb-0">
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
                <dt className="text-muted-foreground">Target</dt>
                <dd>{formatMinutes(commitment.targetMinutes)}</dd>

                <dt className="text-muted-foreground">Started</dt>
                <dd>{formatDateTimeWithOffset(commitment.startedAt)}</dd>

                <dt className="text-muted-foreground">Policy</dt>
                <dd>
                  {commitment.policyVersion.name} — v{commitment.policyVersion.version} (effective{" "}
                  {formatDateTimeWithOffset(commitment.policyVersion.effectiveFrom)})
                </dd>

                <dt className="text-muted-foreground">Match</dt>
                <dd>{formatPolicyMatch(commitment.policyVersion.match)}</dd>

                <dt className="text-muted-foreground">Pauses on</dt>
                <dd>
                  {commitment.pauseOnStates.length > 0
                    ? commitment.pauseOnStates.join(", ")
                    : "Never pauses"}
                </dd>

                <dt className="text-muted-foreground">Warn thresholds</dt>
                <dd>{commitment.policyVersion.warnAtPercent.join("%, ")}%</dd>

                <dt className="text-muted-foreground">Calendar</dt>
                <dd>
                  {commitment.calendar.alwaysOpen ? (
                    "Always open (24/7)"
                  ) : (
                    <>
                      {commitment.calendar.timezone}
                      {", "}
                      {commitment.calendar.weekly
                        .map(formatWeeklyWindow)
                        .join(", ")}
                      {commitment.calendar.holidays.length > 0 &&
                        ` · Holidays: ${commitment.calendar.holidays.join(", ")}`}
                    </>
                  )}
                  <span className="block text-muted-foreground">
                    {commitment.calendar.source === "customer_override"
                      ? "From the customer's calendar override"
                      : commitment.calendar.source === "organization_default"
                        ? "From the organization's default calendar (the matched policy has no calendar of its own)"
                        : "From the matched policy"}
                  </span>
                </dd>

                {commitment.targetChangeHistory.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Target changes</dt>
                    <dd>
                      <ul className="space-y-1">
                        {commitment.targetChangeHistory.map((change) => (
                          <li key={change.changedAt}>
                            {formatMinutes(change.previousTargetMinutes)} →{" "}
                            {formatMinutes(change.newTargetMinutes)} ({formatDateTimeWithOffset(change.changedAt)} —{" "}
                            {change.reason})
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
