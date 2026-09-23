"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Download,
  Link2,
  ListChecks,
  RefreshCcw,
  Search,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes, formatPriorityTier } from "@/lib/format";
import type { AtRiskRowData } from "@/lib/types/at-risk";
import { cn, Utils } from "@/lib/utils";

import { AtRiskCard } from "./AtRiskCard";
import { AtRiskKpiTile } from "./AtRiskKpiTile";

// Runway-time bands, not status buckets — Stitch's KPI matrix
// (`at_risk_queue/code.html`) measures "how soon" a case will breach, not
// "which status bucket" it's already in (that's what each card's own
// StatusBadge already shows).
const IMMEDIATE_THREAT_MINUTES = 60;
const ELEVATED_RISK_MINUTES = 150;

type StatusFilter = "all" | "breached" | "at_risk" | "on_track";
type LegFilter = "all" | "support" | "engineering" | "waiting_customer" | "unknown";
type SeverityFilter = "all" | "P1" | "P2" | "P3" | "P4";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "breached", label: "Breached" },
  { value: "at_risk", label: "At risk" },
  { value: "on_track", label: "On track" },
];

const LEG_FILTERS: { value: LegFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "support", label: "Support" },
  { value: "engineering", label: "Engineering" },
  { value: "waiting_customer", label: "Waiting on customer" },
];

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "P1", label: "P1 Critical" },
  { value: "P2", label: "P2 High" },
  { value: "P3", label: "P3 Normal" },
  { value: "P4", label: "P4 Low" },
];

export const AtRiskView = ({ data }: { data: AtRiskRowData[] }) => {
  const router = useRouter();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [leg, setLeg] = useState<LegFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");

  const breached = useMemo(
    () => data.filter((r) => r.status === "breached"),
    [data],
  );
  const atRisk = useMemo(
    () => data.filter((r) => r.status === "at_risk"),
    [data],
  );
  const engineeringCount = useMemo(
    () => data.filter((r) => r.currentLeg === "engineering").length,
    [data],
  );
  const avgMinutesInLeg =
    data.length > 0
      ? data.reduce((sum, r) => sum + r.minutesInCurrentLeg, 0) / data.length
      : null;

  const immediateThreat = useMemo(
    () => data.filter((r) => r.remainingMinutes < IMMEDIATE_THREAT_MINUTES),
    [data],
  );
  const elevatedRisk = useMemo(
    () =>
      data.filter(
        (r) =>
          r.remainingMinutes >= IMMEDIATE_THREAT_MINUTES &&
          r.remainingMinutes < ELEVATED_RISK_MINUTES,
      ),
    [data],
  );
  const linkedCertainCount = useMemo(
    () => data.filter((r) => r.linkedIssue?.confidence === "certain").length,
    [data],
  );

  const statusCounts = useMemo(
    () => ({
      all: data.length,
      breached: breached.length,
      at_risk: atRisk.length,
      on_track: data.filter((r) => r.status === "on_track").length,
    }),
    [data, breached.length, atRisk.length],
  );

  const legCounts = useMemo(
    () => ({
      all: data.length,
      support: data.filter((r) => r.currentLeg === "support").length,
      engineering: engineeringCount,
      waiting_customer: data.filter((r) => r.currentLeg === "waiting_customer").length,
      unknown: data.filter((r) => r.currentLeg === "unknown").length,
    }),
    [data, engineeringCount],
  );

  const severityCounts = useMemo(() => {
    const counts: Record<SeverityFilter, number> = { all: data.length, P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const row of data) {
      const tier = formatPriorityTier(row.priority);
      if (tier === "P1" || tier === "P2" || tier === "P3" || tier === "P4") {
        counts[tier] += 1;
      }
    }
    return counts;
  }, [data]);

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (status !== "all" && row.status !== status) return false;
        if (leg !== "all" && row.currentLeg !== leg) return false;
        if (severity !== "all" && formatPriorityTier(row.priority) !== severity) return false;

        if (query.trim()) {
          const q = query.trim().toLowerCase();
          const haystack = [row.customerName, row.requesterName, row.subject, row.externalId]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      }),
    [data, status, leg, severity, query],
  );

  return (
    <>
      <Reveal delay={0}>
        <PageHeader
          eyebrow="Continuous, deterministic SLA clocks"
          title={
            <span className="flex flex-wrap items-center gap-2">
              At Risk
              <Badge variant={breached.length > 0 ? "destructive" : "outline"}>
                {data.length} open commitment{data.length !== 1 ? "s" : ""}
              </Badge>
            </span>
          }
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={filtered.length === 0}
                onClick={() => Utils.exportToCsv("at-risk.csv", filtered)}
              >
                <Download className="size-3.5" />
                Export CSV
              </Button>
              <Button size="sm" onClick={() => router.refresh()}>
                <RefreshCcw className="size-3.5" />
                Refresh
              </Button>
            </>
          }
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={0.02}>
          <AtRiskKpiTile
            icon={AlertOctagon}
            label="Immediate threat (< 1h runway)"
            value={immediateThreat.length}
            qualifier="cases"
            tone={immediateThreat.length > 0 ? "destructive" : "default"}
            detail={
              immediateThreat.length > 0 &&
              immediateThreat
                .slice(0, 3)
                .map((r) => r.customerName ?? `#${r.externalId}`)
                .join(", ")
            }
          />
        </Reveal>
        <Reveal delay={0.05}>
          <AtRiskKpiTile
            icon={AlertTriangle}
            label="Elevated risk (1h – 2.5h)"
            value={elevatedRisk.length}
            qualifier="cases"
            tone={elevatedRisk.length > 0 ? "warning" : "default"}
            detail={
              elevatedRisk.length > 0 &&
              elevatedRisk
                .slice(0, 3)
                .map((r) => r.customerName ?? `#${r.externalId}`)
                .join(", ")
            }
          />
        </Reveal>
        <Reveal delay={0.08}>
          <AtRiskKpiTile
            icon={Workflow}
            label="Active clock locus"
            value={
              data.length > 0
                ? `${Math.round((engineeringCount / data.length) * 100)}%`
                : "—"
            }
            qualifier="eng leg"
            detail={`${engineeringCount} of ${data.length} case${data.length !== 1 ? "s" : ""}`}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <AtRiskKpiTile
            icon={ListChecks}
            label="Avg transit latency"
            value={avgMinutesInLeg !== null ? formatMinutes(avgMinutesInLeg) : "—"}
            detail="Mean time in current leg, across all open commitments"
          />
        </Reveal>
      </div>

      <Reveal delay={0.15} className="mt-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-panel">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Severity
              </span>
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSeverity(f.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    severity === f.value
                      ? "bg-interactive text-primary"
                      : "text-muted-foreground hover:bg-interactive/60",
                  )}
                >
                  {f.label} ({severityCounts[f.value]})
                </button>
              ))}

              <span className="mx-1 hidden h-5 w-px bg-border md:block" />

              <span className="px-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Locus
              </span>
              {LEG_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setLeg(f.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    leg === f.value
                      ? "bg-interactive text-primary"
                      : "text-muted-foreground hover:bg-interactive/60",
                  )}
                >
                  {f.label} ({legCounts[f.value]})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Link2 className="size-3.5 text-success" />
                Linked: Certain ({linkedCertainCount}/{data.length})
              </span>

              <div className="relative w-full xl:w-56">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter customer, ticket or subject..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-3">
            <span className="px-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === f.value
                    ? "bg-interactive text-primary"
                    : "text-muted-foreground hover:bg-interactive/60",
                )}
              >
                {f.label} ({statusCounts[f.value]})
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-4 flex flex-col gap-3">
        {data.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No open commitments"
            description="Everything currently tracked is closed."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No commitments match these filters"
            description="Try clearing the severity, locus, status, or search filters."
          />
        ) : (
          filtered.map((row, i) => (
            <Reveal key={row.commitmentId} delay={Math.min(0.02 * i, 0.3)}>
              <AtRiskCard row={row} />
            </Reveal>
          ))
        )}
      </div>

      {data.length > 0 && (
        <Reveal delay={0.2} className="mt-4">
          <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4 text-xs text-muted-foreground">
            Runway is computed continuously from each commitment&apos;s business-calendar target minus
            elapsed business time, honoring the policy&apos;s configured pause states — it does not reset
            when a case changes hands between support and engineering. Refreshes automatically every few
            seconds.
          </div>
        </Reveal>
      )}
    </>
  );
};
