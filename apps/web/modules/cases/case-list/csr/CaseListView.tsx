"use client";

import React, { useMemo, useState } from "react";

import {
  Download,
  Gauge,
  Inbox,
  Link2,
  ListChecks,
  Search,
  Unlink,
  type LucideIcon,
} from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { Card } from "@/components/ui/card";
import { formatPriorityTier } from "@/lib/format";
import { Utils, cn } from "@/lib/utils";
import type { CaseListData } from "@/lib/types/cases";
import { useCaseListColumns } from "./columns";

type StatusFilter = "all" | "breached" | "at_risk" | "on_track" | "met";
type OpenFilter = "all" | "open" | "closed";
type LinkFilter = "all" | "linked" | "unlinked";
type SeverityFilter = "all" | "P1" | "P2" | "P3" | "P4";

const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
  tone: string;
  dot: string;
  badge: string;
}[] = [
  { value: "all", label: "All Cases", tone: "", dot: "", badge: "" },
  {
    value: "at_risk",
    label: "At Risk",
    tone: "text-error",
    dot: "bg-error animate-pulse",
    badge: "bg-error-container text-error",
  },
  {
    value: "breached",
    label: "Breached",
    tone: "text-error",
    dot: "bg-error",
    badge: "bg-surface-container-lowest text-error",
  },
  {
    value: "on_track",
    label: "On Track",
    tone: "text-primary",
    dot: "bg-primary",
    badge: "bg-surface-container-lowest text-primary",
  },
  {
    value: "met",
    label: "Met",
    tone: "text-tertiary",
    dot: "bg-tertiary",
    badge: "bg-surface-container-lowest text-tertiary",
  },
];

const OPEN_FILTERS: { value: OpenFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const LINK_FILTERS: { value: LinkFilter; label: string; tone: string }[] = [
  { value: "all", label: "All", tone: "text-on-surface" },
  { value: "linked", label: "Linked", tone: "text-tertiary" },
  { value: "unlinked", label: "Unlinked", tone: "text-on-surface-variant" },
];

const SEVERITY_FILTERS: {
  value: SeverityFilter;
  label: string;
  tone: string;
}[] = [
  { value: "all", label: "All", tone: "text-primary" },
  { value: "P1", label: "P1", tone: "text-error" },
  { value: "P2", label: "P2", tone: "text-primary-fixed-dim" },
  { value: "P3", label: "P3", tone: "text-on-surface-variant" },
  { value: "P4", label: "P4", tone: "text-outline" },
];

/** Stitch metric tile: caps label + icon on top, mono value + caption below. */
function MetricTile({
  icon: Icon,
  label,
  value,
  caption,
  tone,
  spin,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  caption: string;
  tone?: "error" | "tertiary" | "muted";
  spin?: boolean;
}) {
  const text =
    tone === "error"
      ? "text-error"
      : tone === "tertiary"
        ? "text-tertiary"
        : "text-on-surface-variant";
  return (
    <div className="flex flex-col justify-between rounded bg-surface-container-low p-space-md shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-label-caps text-label-caps",
            tone ? text : "text-on-surface-variant",
          )}
        >
          {label}
        </span>
        <Icon
          className={cn(
            "size-[18px]",
            tone === "error"
              ? "text-error"
              : tone === "tertiary"
                ? "text-tertiary"
                : "text-primary",
            spin && "animate-spin [animation-duration:9s]",
          )}
        />
      </div>
      <div className="mt-space-xs flex items-baseline gap-space-xs">
        <span
          className={cn(
            "font-mono-metric-lg text-mono-metric-lg",
            tone ? text : "text-on-surface",
          )}
        >
          {value}
        </span>
        <span className="font-code-audit text-code-audit text-on-surface-variant">
          {caption}
        </span>
      </div>
    </div>
  );
}

const GROUP_LABEL =
  "px-2 font-label-caps text-label-caps text-outline sm:inline";
const groupBtn = (active: boolean, tone: string) =>
  cn(
    "whitespace-nowrap rounded px-space-sm py-1 font-label-caps text-label-caps transition-colors",
    active
      ? "bg-surface-container text-primary"
      : cn("hover:bg-surface-container", tone),
  );

interface CaseListViewProps {
  data: CaseListData;
  /** The worker's active poll interval, for the "Live Ledger Poll" indicator — `SlaAutoRefreshProvider` (mounted by the SSR shell) is what actually re-fetches on this cadence; this prop only labels it. */
  pollIntervalMs?: number;
}

export const CaseListView = ({ data, pollIntervalMs }: CaseListViewProps) => {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openState, setOpenState] = useState<OpenFilter>("all");
  const [linkState, setLinkState] = useState<LinkFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const columns = useCaseListColumns();

  const openCases = useMemo(
    () => data.cases.filter((c) => !c.closedAt),
    [data.cases],
  );
  const breachedCases = useMemo(
    () => data.cases.filter((c) => c.worstCommitmentStatus === "breached"),
    [data.cases],
  );
  const atRiskCases = useMemo(
    () => data.cases.filter((c) => c.worstCommitmentStatus === "at_risk"),
    [data.cases],
  );
  const linkedCases = useMemo(
    () => data.cases.filter((c) => c.primaryLink !== null),
    [data.cases],
  );
  const linkedCertainCases = useMemo(
    () => data.cases.filter((c) => c.primaryLink?.confidence === "certain"),
    [data.cases],
  );
  const runningClockCases = useMemo(
    () => data.cases.filter((c) => c.liveCommitment !== null),
    [data.cases],
  );

  const statusCounts = useMemo(
    () => ({
      all: data.cases.length,
      breached: breachedCases.length,
      at_risk: atRiskCases.length,
      on_track: data.cases.filter((c) => c.worstCommitmentStatus === "on_track")
        .length,
      met: data.cases.filter((c) => c.worstCommitmentStatus === "met").length,
    }),
    [data.cases, breachedCases.length, atRiskCases.length],
  );

  const openCounts = useMemo(
    () => ({
      all: data.cases.length,
      open: openCases.length,
      closed: data.cases.length - openCases.length,
    }),
    [data.cases, openCases.length],
  );

  const linkCounts = useMemo(
    () => ({
      all: data.cases.length,
      linked: linkedCases.length,
      unlinked: data.cases.length - linkedCases.length,
    }),
    [data.cases, linkedCases.length],
  );

  const severityCounts = useMemo(() => {
    const counts: Record<SeverityFilter, number> = {
      all: data.cases.length,
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };
    for (const row of data.cases) {
      const tier = formatPriorityTier(row.priority);
      if (tier === "P1" || tier === "P2" || tier === "P3" || tier === "P4") {
        counts[tier] += 1;
      }
    }
    return counts;
  }, [data.cases]);

  const filtered = useMemo(
    () =>
      data.cases.filter((row) => {
        if (status !== "all" && row.worstCommitmentStatus !== status)
          return false;
        if (openState === "open" && row.closedAt) return false;
        if (openState === "closed" && !row.closedAt) return false;
        if (linkState === "linked" && !row.primaryLink) return false;
        if (linkState === "unlinked" && row.primaryLink) return false;
        if (severity !== "all" && formatPriorityTier(row.priority) !== severity)
          return false;
        return true;
      }),
    [data.cases, status, openState, linkState, severity],
  );

  if (data.cases.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No cases yet"
        description="Cases will show up here once they start syncing in."
      />
    );
  }

  return (
    <div className="relative flex w-full flex-col gap-space-lg">
      {/* Page header + operational ledger metadata */}
      <Reveal delay={0}>
        <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm">
              <h1 className="font-display-hero text-display-hero tracking-tight text-on-surface">
                Cases
              </h1>
              <span className="rounded bg-surface-container-high px-space-xs py-0.5 font-label-caps text-label-caps uppercase text-primary">
                Operational Ledger
              </span>
              <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Continuous SLA ledger across Zendesk customer touches and Jira
              engineering handoffs
            </p>
          </div>
          <button
            type="button"
            disabled={data.cases.length === 0}
            onClick={() => Utils.exportToCsv("all-cases.csv", data.cases)}
            className="group flex shrink-0 items-center gap-space-sm rounded bg-surface-container-high px-space-md py-2 font-headline-sm text-body-md text-on-surface shadow-sm transition-all hover:bg-surface-bright disabled:opacity-50"
          >
            <Download className="size-[18px] text-primary transition-transform group-hover:scale-110" />
            <span>Export Full CSV</span>
            <span className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-code-audit text-code-audit text-on-surface-variant">
              {data.cases.length} rec
            </span>
          </button>
        </div>
      </Reveal>

      {/* Metric summary tiles */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
          <MetricTile
            icon={Inbox}
            label="TOTAL TRACKED CASES"
            value={data.cases.length}
            caption={`${openCases.length} open`}
          />
          <MetricTile
            icon={Gauge}
            label="ACTIVE RUNNING SLA CLOCK"
            value={runningClockCases.length}
            caption="burning now"
            tone="error"
            spin={runningClockCases.length > 0}
          />
          <MetricTile
            icon={Link2}
            label="LINKED — CERTAIN"
            value={linkedCertainCases.length}
            caption={`${((linkedCertainCases.length / data.cases.length) * 100).toFixed(1)}% deterministic`}
            tone="tertiary"
          />
          <MetricTile
            icon={Unlink}
            label="STANDALONE / UNLINKED"
            value={data.cases.length - linkedCases.length}
            caption="support-only"
            tone="muted"
          />
        </div>
      </Reveal>

      {/* Integrated filter bar & query console */}
      <Reveal delay={0.1}>
        <div className="flex flex-col gap-space-md rounded bg-surface-container-low p-space-md shadow-sm">
          <div className="flex flex-col items-stretch justify-between gap-space-md lg:flex-row lg:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-2.5 size-[18px] text-outline" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search customer, ticket ID, or subject…"
                aria-label="Search cases"
                className="w-full rounded bg-surface-container-lowest py-2 pl-10 pr-24 font-body-md text-body-md text-on-surface shadow-inner placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="pointer-events-none absolute right-2.5 top-2 flex items-center gap-1">
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-code-audit text-[10px] text-on-surface-variant">
                  ZD
                </span>
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-code-audit text-[10px] text-on-surface-variant">
                  ENG
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 self-start rounded bg-surface-container-lowest p-1 lg:self-auto">
              <span className={GROUP_LABEL}>PRIORITY:</span>
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSeverity(f.value)}
                  className={groupBtn(severity === f.value, f.tone)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1 self-start rounded bg-surface-container-lowest p-1 lg:self-auto">
              <span className={GROUP_LABEL}>LINK:</span>
              {LINK_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setLinkState(f.value)}
                  className={groupBtn(linkState === f.value, f.tone)}
                >
                  {f.label}
                  {f.value !== "all" && ` (${linkCounts[f.value]})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-space-md gap-y-space-sm pt-space-xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="mr-space-xs font-label-caps text-label-caps uppercase tracking-wider text-outline">
                SLA Status:
              </span>
              {STATUS_FILTERS.map((f) => {
                const active = status === f.value;
                const isAll = f.value === "all";
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      "flex items-center gap-space-xs rounded px-2.5 py-1 font-label-caps text-label-caps transition-colors",
                      active
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container-high text-on-surface hover:bg-surface-bright",
                    )}
                  >
                    {!isAll && (
                      <span className={cn("size-1.5 rounded-full", f.dot)} />
                    )}
                    <span className={cn(!active && f.tone)}>{f.label}</span>
                    <span
                      className={cn(
                        "rounded px-1 font-code-audit text-[10px]",
                        active ? "bg-on-primary/20" : f.badge,
                      )}
                    >
                      {statusCounts[f.value]}
                    </span>
                  </button>
                );
              })}

              <span className="mx-1 hidden h-5 w-px bg-border md:block" />

              {OPEN_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setOpenState(f.value)}
                  className={groupBtn(
                    openState === f.value,
                    "text-on-surface-variant",
                  )}
                >
                  {f.value === "all" ? "Any state" : f.label} (
                  {openCounts[f.value]})
                </button>
              ))}
            </div>

            {pollIntervalMs !== undefined && (
              <div className="ml-auto flex shrink-0 items-center gap-space-sm">
                <span className="font-code-audit text-code-audit text-on-surface-variant">
                  Live Ledger Poll: {Math.round(pollIntervalMs / 1000)}s
                </span>
                <span className="size-2 rounded-full bg-tertiary" />
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* Dense operational data table */}
      <Reveal delay={0.15}>
        <div className="overflow-hidden rounded bg-surface-container-low shadow-md">
          <DataTable
            title="Cases"
            className="p-0 lg:p-0"
            textClassName=""
            headerClassName="border-0 bg-surface-container-lowest font-label-caps text-label-caps text-outline hover:bg-surface-container-lowest"
            headCellClassName="h-auto whitespace-normal align-middle px-2.5 py-3 text-inherit font-[inherit] tracking-[inherit] first:ps-space-md last:pe-space-md"
            cellClassName="px-2.5 py-3 align-top first:ps-space-md last:pe-space-md"
            rowClassName={(_, i) =>
              cn(
                "border-0 hover:bg-surface-container-high",
                i % 2 === 0
                  ? "bg-surface-container"
                  : "bg-surface-container-low",
              )
            }
            columns={columns}
            data={filtered}
            globalFilter={globalFilter}
            setGlobalFilter={setGlobalFilter}
            empty={
              <EmptyState
                icon={Search}
                title="No cases match these filters"
                description="Try clearing the SLA status, case status, or search filters."
              />
            }
          />
        </div>
      </Reveal>
    </div>
  );
};
