"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CountdownClock } from "@/components/shared/countdown-clock";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimeAllocationBar } from "@/components/shared/time-allocation-bar";
import { caseCommitmentHref } from "@/lib/case-links";
import {
  formatCommitmentKind,
  formatLeg,
  formatMinutes,
  formatPriorityTier,
} from "@/lib/format";
import type { AtRiskRowData } from "@/lib/types/at-risk";
import { cn } from "@/lib/utils";


const STATUS_EDGE: Record<string, string> = {
  breached: "bg-destructive",
  at_risk: "bg-warning",
  on_track: "bg-success",
  met: "bg-success",
  cancelled: "bg-border-strong",
};

const CLOCK_TONE: Record<string, string> = {
  breached: "text-destructive",
  at_risk: "text-warning",
  on_track: "text-foreground",
  met: "text-success",
  cancelled: "text-muted-foreground",
};

const LEG_DOT: Record<string, string> = {
  support: "bg-leg-support",
  engineering: "bg-leg-engineering",
  waiting_customer: "bg-leg-waiting",
  unknown: "bg-leg-unknown",
};

const SEVERITY_BADGE_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  P1: "destructive",
  P2: "destructive",
  P3: "warning",
  P4: "outline",
};

const LINKED_SYSTEM_LABEL: Record<string, string> = {
  jira: "ENG",
  linear: "LIN",
  github: "GH",
};

export function AtRiskCard({ row }: { row: AtRiskRowData }) {
  const href = caseCommitmentHref(row.caseId, row.commitmentId);
  const severity = formatPriorityTier(row.priority);

  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-panel transition-colors hover:border-border-strong sm:p-5">
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          STATUS_EDGE[row.status] ?? "bg-border-strong",
        )}
      />

      <div className="flex flex-col gap-3 pl-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {severity && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xxs font-semibold uppercase tracking-wider",
                  SEVERITY_BADGE_VARIANT[severity] === "destructive" &&
                    "bg-destructive/15 text-destructive",
                  SEVERITY_BADGE_VARIANT[severity] === "warning" &&
                    "bg-warning/15 text-warning",
                  SEVERITY_BADGE_VARIANT[severity] === "outline" &&
                    "bg-surface-subtle text-muted-foreground",
                )}
              >
                {severity}
              </span>
            )}

            <StatusBadge status={row.status} />

            <span className="flex items-center gap-1 font-mono text-xs">
              <Link
                href={href}
                className="rounded bg-surface-subtle px-2 py-0.5 text-primary hover:underline"
              >
                #{row.externalId}
              </Link>
              {row.linkedIssue && (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    ↔
                  </span>
                  <span className="rounded bg-surface-subtle px-2 py-0.5 text-primary">
                    {LINKED_SYSTEM_LABEL[row.linkedIssue.system] ??
                      row.linkedIssue.system.toUpperCase()}
                    -{row.linkedIssue.externalId}
                  </span>
                </>
              )}
            </span>

            <span className="text-xxs font-medium uppercase tracking-wider text-muted-foreground">
              {formatCommitmentKind(row.kind)}
            </span>

            {row.tier && (
              <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
                {row.tier}
              </span>
            )}
          </div>

          <h3 className="truncate text-sm font-semibold text-foreground">
            {row.customerName ?? "Unknown customer"}
            {row.subject && (
              <span className="font-normal text-muted-foreground">
                {" — "}
                {row.subject}
              </span>
            )}
          </h3>

          {row.requesterName && (
            <p className="text-xs text-muted-foreground">
              Requested by {row.requesterName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 rounded-lg bg-surface-subtle px-4 py-2.5 lg:items-end">
          <span className="text-xxs font-medium uppercase tracking-wider text-muted-foreground">
            {row.status === "breached" ? "Overdue by" : "Runway remaining"}
          </span>
          <CountdownClock
            remainingMinutes={row.remainingMinutes}
            className={cn("text-xl font-bold leading-none", CLOCK_TONE[row.status])}
          />
          <span className="text-xxs text-muted-foreground">
            Ceiling: {formatMinutes(row.targetMinutes)} {formatCommitmentKind(row.kind)} target
          </span>
        </div>
      </div>

      <div className="border-t border-border-subtle pl-2 pt-3">
        <TimeAllocationBar
          targetMinutes={row.targetMinutes}
          elapsedMinutes={row.elapsedSeconds / 60}
          remainingMinutes={row.remainingMinutes}
          supportLegMinutes={row.supportLegMinutes}
          engineeringLegMinutes={row.engineeringLegMinutes}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pl-2 pt-3 text-xs text-muted-foreground">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn("size-1.5 rounded-full", LEG_DOT[row.currentLeg] ?? "bg-leg-unknown")}
            />
            <span>
              Currently in{" "}
              <span className="font-medium text-foreground">{formatLeg(row.currentLeg)}</span> ·{" "}
              {formatMinutes(row.minutesInCurrentLeg)} in leg
              {row.linkedIssue && (
                <>
                  {" "}
                  ·{" "}
                  {LINKED_SYSTEM_LABEL[row.linkedIssue.system] ??
                    row.linkedIssue.system.toUpperCase()}
                  -{row.linkedIssue.externalId}
                </>
              )}
            </span>
          </div>

          <span>
            Assignee: Support (
            <span className="text-foreground">{row.supportAssigneeName ?? "Unassigned"}</span>)
          </span>
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Inspect timeline
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
