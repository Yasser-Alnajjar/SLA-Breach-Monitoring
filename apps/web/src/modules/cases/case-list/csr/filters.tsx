"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  GROUP_LABEL,
  LINK_FILTERS,
  OPEN_FILTERS,
  SEVERITY_FILTERS,
  STATUS_FILTERS,
  type LinkFilter,
  type OpenFilter,
  type SeverityFilter,
  type StatusFilter,
} from "./constants";

interface CaseListFiltersProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;

  status: StatusFilter;
  setStatus: (value: StatusFilter) => void;

  openState: OpenFilter;
  setOpenState: (value: OpenFilter) => void;

  linkState: LinkFilter;
  setLinkState: (value: LinkFilter) => void;

  severity: SeverityFilter;
  setSeverity: (value: SeverityFilter) => void;

  statusCounts: Record<StatusFilter, number>;
  openCounts: Record<OpenFilter, number>;
  linkCounts: Record<LinkFilter, number>;

  pollIntervalMs?: number;
}

const groupBtn = (active: boolean, tone: string) =>
  cn(
    "rounded px-2 py-1 font-mono text-xxs font-semibold tracking-wider",
    active
      ? "bg-surface-container text-primary"
      : cn("hover:bg-surface-container", tone),
  );

export function CaseListFilters({
  globalFilter,
  setGlobalFilter,
  status,
  setStatus,
  openState,
  setOpenState,
  linkState,
  setLinkState,
  severity,
  setSeverity,
  statusCounts,
  openCounts,
  linkCounts,
  pollIntervalMs,
}: CaseListFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded bg-surface-container-low p-4 shadow-sm">
      <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4.5 text-outline" />

          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
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

        <FilterGroup
          label="SEVERITY:"
          options={SEVERITY_FILTERS}
          value={severity}
          counts={undefined}
          onChange={setSeverity}
        />

        <FilterGroup
          label="LINK:"
          options={LINK_FILTERS}
          value={linkState}
          counts={linkCounts}
          onChange={setLinkState}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono text-xxs font-semibold tracking-wider uppercase text-outline">
            SLA Status:
          </span>

          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            const isAll = filter.value === "all";

            return (
              <Button
                key={filter.value}
                type="button"
                variant="bare"
                size="sm"
                aria-pressed={active}
                onClick={() => setStatus(filter.value)}
                className={cn(
                  "gap-1 rounded px-2.5 py-1 font-mono text-xxs font-semibold tracking-wider transition-colors",
                  active
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-high text-on-surface hover:bg-surface-bright",
                )}
              >
                {!isAll && (
                  <span className={cn("size-1.5 rounded-full", filter.dot)} />
                )}

                <span className={cn(!active && filter.tone)}>
                  {filter.label}
                </span>

                <span
                  className={cn(
                    "rounded px-1 font-mono text-xxs",
                    active ? "bg-on-primary/20" : filter.badge,
                  )}
                >
                  {statusCounts[filter.value]}
                </span>
              </Button>
            );
          })}

          <span className="mx-1 hidden h-5 w-px bg-border md:block" />

          {OPEN_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant="bare"
              size="sm"
              aria-pressed={openState === filter.value}
              onClick={() => setOpenState(filter.value)}
              className={groupBtn(
                openState === filter.value,
                "text-on-surface-variant",
              )}
            >
              {filter.value === "all" ? "Any state" : filter.label} (
              {openCounts[filter.value]})
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
  );
}

interface FilterGroupProps {
  label: string;
  options: readonly {
    value: string;
    label: string;
    tone: string;
  }[];
  value: string;
  counts?: Record<string, number>;
  onChange: (value: never) => void;
}

function FilterGroup({
  label,
  options,
  value,
  counts,
  onChange,
}: FilterGroupProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 self-start rounded bg-surface-container-lowest p-1 lg:self-auto">
      <span className={GROUP_LABEL}>{label}</span>

      {options.map((filter) => (
        <Button
          key={filter.value}
          type="button"
          variant="bare"
          size="sm"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value as never)}
          className={groupBtn(value === filter.value, filter.tone)}
        >
          {filter.label}
          {counts && filter.value !== "all"
            ? ` (${counts[filter.value]})`
            : null}
        </Button>
      ))}
    </div>
  );
}
