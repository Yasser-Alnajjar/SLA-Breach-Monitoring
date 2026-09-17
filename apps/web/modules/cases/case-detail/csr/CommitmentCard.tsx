"use client";

import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatCommitmentDeadline,
  formatCommitmentKind,
  formatDateTime,
  formatPolicyMatch,
  formatSeconds,
  formatWeeklyWindow,
} from "@/lib/format";
import { STATUS_BORDER_CLASS } from "@/lib/status-styles";
import type { CommitmentDetail } from "@/lib/types/cases";

export const CommitmentCard = ({ commitment }: { commitment: CommitmentDetail }) => {
  return (
    <Card className={`border-l-4 ${STATUS_BORDER_CLASS[commitment.status]}`}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{formatCommitmentKind(commitment.kind)}</span>
          <div className="flex items-center gap-2">
            {commitment.clockState !== "stopped" && (
              <Badge variant="outline" className="text-nowrap">
                <span
                  className={`size-2 rounded-full ${
                    commitment.clockState === "paused" ? "bg-clock-paused" : "bg-clock-running"
                  }`}
                />
                {commitment.clockState === "paused" ? "Paused" : "Running"}
              </Badge>
            )}
            <StatusBadge status={commitment.status} />
          </div>
        </div>
        <p className="mt-2 font-display text-2xl font-medium tracking-tight">
          {commitment.status === "breached"
            ? `${formatSeconds(commitment.breachedBySeconds ?? -commitment.remainingSeconds)} over target`
            : commitment.remainingSeconds < 0
              ? `${formatSeconds(-commitment.remainingSeconds)} overdue`
              : `${formatSeconds(commitment.remainingSeconds)} remaining`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{formatCommitmentDeadline(commitment)}</p>

        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            How this was calculated
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
            <dt className="text-muted-foreground">Policy version</dt>
            <dd>
              v{commitment.policyVersion.version} (effective {formatDateTime(commitment.policyVersion.effectiveFrom)})
            </dd>
            <dt className="text-muted-foreground">Match</dt>
            <dd>{formatPolicyMatch(commitment.policyVersion.match)}</dd>
            <dt className="text-muted-foreground">Pauses on</dt>
            <dd>
              {commitment.policyVersion.pauseOnStates.length > 0
                ? commitment.policyVersion.pauseOnStates.join(", ")
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
                  {commitment.calendar.weekly.map(formatWeeklyWindow).join(", ")}
                  {commitment.calendar.holidays.length > 0 &&
                    ` · Holidays: ${commitment.calendar.holidays.join(", ")}`}
                </>
              )}
            </dd>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
};
