"use client";

import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { LegFilter, SeverityFilter } from "./types";

type AtRiskFiltersProps = {
  severity: SeverityFilter;
  leg: LegFilter;
  query: string;
  severityCounts: Record<SeverityFilter, number>;
  legCounts: Record<LegFilter, number>;
  onSeverityChange: (value: SeverityFilter) => void;
  onLegChange: (value: LegFilter) => void;
  onQueryChange: (value: string) => void;
};

const SEVERITY_FILTERS: {
  value: SeverityFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "P1", label: "P1 Critical" },
  { value: "P2", label: "P2 High" },
  { value: "P3", label: "P3 Normal" },
  { value: "P4", label: "P4 Low" },
];

const LEG_FILTERS: {
  value: LegFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "engineering", label: "Engineering Leg" },
  { value: "support", label: "Support Leg" },
];

export const AtRiskFilters = ({
  severity,
  leg,
  query,
  severityCounts,
  legCounts,
  onSeverityChange,
  onLegChange,
  onQueryChange,
}: AtRiskFiltersProps) => {
  return (
    <div className="rounded bg-card p-2 font-mono shadow-panel">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Segmented category filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-1.5 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
            Severity
          </span>

          {SEVERITY_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant="filter"
              size="chip"
              className="text-xxs"
              aria-pressed={severity === filter.value}
              onClick={() => onSeverityChange(filter.value)}
            >
              {filter.label} ({severityCounts[filter.value]})
            </Button>
          ))}

          <span className="mx-1 hidden h-5 w-px bg-border md:block" />

          <span className="px-1.5 text-xxs font-medium uppercase tracking-wider text-muted-foreground">
            Locus
          </span>

          {LEG_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant="filter"
              size="chip"
              aria-pressed={leg === filter.value}
              onClick={() => onLegChange(filter.value)}
            >
              {filter.label} ({legCounts[filter.value]})
            </Button>
          ))}
        </div>

        {/* Link status + quick search */}
        <div className="flex items-center gap-2">
          <div className="relative w-full min-w-0 xl:w-60">
            <Filter className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Filter customer, ticket or ID..."
              className="pl-8"
              aria-label="Filter customer, ticket or ID"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
