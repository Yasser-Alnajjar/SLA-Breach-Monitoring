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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="flex flex-col justify-between rounded bg-surface-container-low p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-xxs font-semibold tracking-wider",
            tone ? text : "text-on-surface-variant",
          )}
        >
          {label}
        </span>
        <Icon
          className={cn(
            "size-4.5",
            tone === "error"
              ? "text-error"
              : tone === "tertiary"
                ? "text-tertiary"
                : "text-primary",
            spin && "animate-spin animation-duration-[9s]",
          )}
        />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-2xl font-medium tracking-tight",
            tone ? text : "text-on-surface",
          )}
        >
          {value}
        </span>
        <span className="font-mono text-xs text-on-surface-variant">
          {caption}
        </span>
      </div>
    </div>
  );
}

const GROUP_LABEL =
  "px-2 font-mono text-xxs font-semibold tracking-wider text-outline sm:inline";
const groupBtn = (active: boolean, tone: string) =>
  cn(
    "rounded px-2 py-1 font-mono text-xxs font-semibold tracking-wider",
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
    <div className="relative flex w-full flex-col gap-6">
      {/* Page header + operational ledger metadata */}
      <Reveal delay={0}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className=" text-4xl font-semibold tracking-tight text-on-surface">
                Cases
              </h1>
              <span className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-xxs font-semibold tracking-wider uppercase text-primary">
                Operational Ledger
              </span>
              <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
            </div>
            <p className=" text-sm text-on-surface-variant">
              Continuous SLA ledger across Zendesk customer touches and Jira
              engineering handoffs
            </p>
          </div>
          <Button
            type="button"
            variant="surface"
            size="toolbar"
            disabled={data.cases.length === 0}
            onClick={() => Utils.exportToCsv("all-cases.csv", data.cases)}
            className="group shrink-0 px-4 shadow-sm hover:bg-surface-bright"
          >
            <Download className="size-4.5 text-primary transition-transform group-hover:scale-110" />
            <span>Export Full CSV</span>
            <span className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono text-xs text-on-surface-variant">
              {data.cases.length} rec
            </span>
          </Button>
        </div>
      </Reveal>

      {/* Metric summary tiles */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
        <div className="flex flex-col gap-4 rounded bg-surface-container-low p-4 shadow-sm">
          <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-3 top-2.5 size-4.5 text-outline" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search customer, ticket ID, or subject…"
                aria-label="Search cases"
                className="h-auto rounded border-0 bg-surface-container-lowest py-2 pl-10 pr-24 text-sm text-on-surface shadow-inner placeholder:text-outline focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 md:text-sm"
              />
              <div className="pointer-events-none absolute right-2.5 top-2 flex items-center gap-1">
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-xxs text-on-surface-variant">
                  ZD
                </span>
                <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-xxs text-on-surface-variant">
                  ENG
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 self-start rounded bg-surface-container-lowest p-1 lg:self-auto">
              <span className={GROUP_LABEL}>PRIORITY:</span>
              {SEVERITY_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant="bare"
                  size="sm"
                  aria-pressed={severity === f.value}
                  onClick={() => setSeverity(f.value)}
                  className={groupBtn(severity === f.value, f.tone)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1 self-start rounded bg-surface-container-lowest p-1 lg:self-auto">
              <span className={GROUP_LABEL}>LINK:</span>
              {LINK_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant="bare"
                  size="sm"
                  aria-pressed={linkState === f.value}
                  onClick={() => setLinkState(f.value)}
                  className={groupBtn(linkState === f.value, f.tone)}
                >
                  {f.label}
                  {f.value !== "all" && ` (${linkCounts[f.value]})`}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 font-mono text-xxs font-semibold tracking-wider uppercase text-outline">
                SLA Status:
              </span>
              {STATUS_FILTERS.map((f) => {
                const active = status === f.value;
                const isAll = f.value === "all";
                return (
                  <Button
                    key={f.value}
                    type="button"
                    variant="bare"
                    size="sm"
                    aria-pressed={active}
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      "gap-1 rounded px-2.5 py-1 font-mono text-xxs font-semibold tracking-wider transition-colors",
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
                        "rounded px-1 font-mono text-xxs",
                        active ? "bg-on-primary/20" : f.badge,
                      )}
                    >
                      {statusCounts[f.value]}
                    </span>
                  </Button>
                );
              })}

              <span className="mx-1 hidden h-5 w-px bg-border md:block" />

              {OPEN_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant="bare"
                  size="sm"
                  aria-pressed={openState === f.value}
                  onClick={() => setOpenState(f.value)}
                  className={groupBtn(
                    openState === f.value,
                    "text-on-surface-variant",
                  )}
                >
                  {f.value === "all" ? "Any state" : f.label} (
                  {openCounts[f.value]})
                </Button>
              ))}
            </div>

            {pollIntervalMs !== undefined && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-on-surface-variant">
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
            headerClassName=" border-0 bg-surface-container-lowest font-mono text-xxs font-semibold tracking-wider text-outline hover:bg-surface-container-lowest"
            headCellClassName="h-auto whitespace-normal align-middle px-2.5 py-3 text-inherit font-[inherit] tracking-[inherit] first:ps-4 last:pe-4"
            cellClassName="px-2.5 py-3 align-top first:ps-4 last:pe-4"
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
