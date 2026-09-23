"use client";

import { useEffect, useState } from "react";

import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Ticks a commitment's remaining time down once a second between server
 * refreshes, purely for display — `remainingMinutes` (recomputed on every
 * `SlaAutoRefreshProvider` refresh) stays the source of truth and resyncs
 * this clock whenever it changes.
 */
export function CountdownClock({
  remainingMinutes,
  className,
}: {
  remainingMinutes: number;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(() => Math.round(remainingMinutes * 60));

  useEffect(() => {
    setSeconds(Math.round(remainingMinutes * 60));
  }, [remainingMinutes]);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);

  const overdue = seconds < 0;

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {overdue ? `${formatSeconds(-seconds)} over` : formatSeconds(seconds)}
    </span>
  );
}
