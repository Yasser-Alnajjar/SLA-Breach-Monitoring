import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A dedicated KPI tile for this page rather than an extension of the shared
 * `stat-tile.tsx` — this page's tiles measure runway-time-bands (Immediate
 * Threat / Elevated Risk / Active Clock Locus / Avg Transit Latency), a
 * different dimension than every other screen's status-count tiles, and
 * `stat-tile.tsx` is shared across other in-flight redesigned pages.
 */
export function AtRiskKpiTile({
  icon: Icon,
  label,
  value,
  qualifier,
  detail,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  qualifier?: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "destructive" | "warning" | "success";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          tone === "destructive" && "bg-destructive",
          tone === "warning" && "bg-warning",
          tone === "success" && "bg-success",
          tone === "default" && "bg-border-strong",
        )}
      />

      <div className="flex items-center justify-between gap-2 pl-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            tone === "destructive" && "text-destructive",
            tone === "warning" && "text-warning",
            tone === "success" && "text-success",
            tone === "default" && "text-muted-foreground",
          )}
        />
      </div>

      <p className="mt-1.5 pl-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}{" "}
        {qualifier && (
          <span className="text-xs font-medium text-muted-foreground">{qualifier}</span>
        )}
      </p>

      {detail && (
        <p className="mt-1 truncate pl-2 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}
