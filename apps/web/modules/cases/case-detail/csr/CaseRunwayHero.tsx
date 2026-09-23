"use client";

import { useEffect, useState } from "react";

import { formatClockDigits, formatCommitmentKind, formatLeg } from "@/lib/format";
import type { CommitmentDetail } from "@/lib/types/cases";
import type { Leg } from "@sla/core";
import { cn } from "@/lib/utils";

const STATUS_PRECEDENCE = ["breached", "at_risk", "on_track"] as const;

export function pickHeroCommitment(commitments: CommitmentDetail[]): CommitmentDetail | null {
  const open = commitments.filter((c) => c.closedAt === null);
  if (open.length === 0) return null;
  return (
    [...open].sort(
      (a, b) =>
        STATUS_PRECEDENCE.indexOf(a.status as (typeof STATUS_PRECEDENCE)[number]) -
        STATUS_PRECEDENCE.indexOf(b.status as (typeof STATUS_PRECEDENCE)[number]),
    )[0] ?? null
  );
}

const COUNTER_CLASS: Record<string, string> = {
  breached: "text-[var(--error)]",
  at_risk:  "text-[var(--error)]",
  on_track: "text-[var(--on-surface)]",
};

const DOT_CLASS: Record<string, string> = {
  breached: "bg-[var(--error)]",
  at_risk:  "bg-[var(--warning)]",
  on_track: "bg-[var(--primary)]",
};

export function CaseRunwayHero({
  commitment,
  currentLeg,
  linkedIssueLabel,
}: {
  commitment: CommitmentDetail;
  currentLeg: Leg;
  linkedIssueLabel: string | null;
}) {
  const getRemaining = () => {
    if (commitment.clockState !== "running" || !commitment.effectiveDueAt)
      return commitment.remainingSeconds;
    return Math.floor(
      (new Date(commitment.effectiveDueAt).getTime() - Date.now()) / 1000,
    );
  };

  const [remainingSeconds, setRemainingSeconds] = useState(commitment.remainingSeconds);

  useEffect(() => {
    setRemainingSeconds(getRemaining());
    if (commitment.clockState !== "running" || !commitment.effectiveDueAt) return;
    const id = window.setInterval(() => setRemainingSeconds(getRemaining()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitment.effectiveDueAt, commitment.clockState]);

  const dot    = DOT_CLASS[commitment.status]    ?? "bg-[var(--primary)]";
  const counter = COUNTER_CLASS[commitment.status] ?? "text-[var(--on-surface)]";
  const overdue = remainingSeconds < 0;

  return (
    <div className="flex min-w-[280px] flex-col items-start rounded-lg bg-[var(--surface-container)] p-4 lg:items-end">
      {/* "Clock Active in Engineering" label with pulsing dot */}
      <div className="flex items-center gap-2">
        <span className="relative flex size-3">
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              dot,
            )}
          />
          <span
            className={cn("relative inline-flex size-3 rounded-full", dot)}
          />
        </span>
        <span className="font-[family-name:var(--font-mono,monospace)] text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
          Clock Active in {formatLeg(currentLeg)}
        </span>
      </div>

      {/* Big mono countdown */}
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-[family-name:var(--font-mono,monospace)] text-[30px] leading-[38px] font-medium tabular-nums",
            counter,
          )}
        >
          {formatClockDigits(remainingSeconds)}
        </span>
        <span className="text-sm text-[var(--outline)]">
          {overdue ? "overdue" : "runway remaining"}
        </span>
      </div>

      {/* Kind caption */}
      <span className="mt-1 font-[family-name:var(--font-mono,monospace)] text-[11px] text-[var(--outline-variant)]">
        {formatCommitmentKind(commitment.kind)}
      </span>

      {/* Active leg + linked issue */}
      {linkedIssueLabel && (
        <span className="font-[family-name:var(--font-mono,monospace)] text-[12px] leading-4 text-[var(--outline-variant)]">
          Active leg: {formatLeg(currentLeg)} ({linkedIssueLabel})
        </span>
      )}
    </div>
  );
}
