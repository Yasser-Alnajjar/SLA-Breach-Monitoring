"use client";

import { BadgeCheck, ListChecks, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { Utils } from "@/lib/utils";
import type { AtRiskRowData } from "@/lib/types/at-risk";
import { formatPriorityTier } from "@/lib/format";

import { AtRiskCard } from "./AtRiskCard";
import { AtRiskFilters } from "./AtRiskFilters";
import type { LegFilter, SeverityFilter } from "./types";
import { AtRiskHeader } from "./AtRiskHeader";
import { AtRiskKpiGrid } from "./AtRiskKpiGrid";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const AtRiskView = ({ data }: { data: AtRiskRowData[] }) => {
  const router = useRouter();

  const [leg, setLeg] = useState<LegFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");

  const breachedCount = useMemo(
    () => data.filter((row) => row.status === "breached").length,
    [data],
  );

  const severityCounts = useMemo(() => {
    const counts: Record<SeverityFilter, number> = {
      all: data.length,
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
    };

    for (const row of data) {
      const tier = formatPriorityTier(row.priority);

      if (tier === "P1" || tier === "P2" || tier === "P3" || tier === "P4") {
        counts[tier] += 1;
      }
    }

    return counts;
  }, [data]);

  const legCounts = useMemo(
    () => ({
      all: data.length,
      support: data.filter((row) => row.currentLeg === "support").length,
      engineering: data.filter((row) => row.currentLeg === "engineering")
        .length,
      waiting_customer: data.filter(
        (row) => row.currentLeg === "waiting_customer",
      ).length,
      unknown: data.filter((row) => row.currentLeg === "unknown").length,
    }),
    [data],
  );

  const linkedCertainCount = useMemo(
    () =>
      data.filter((row) => row.linkedIssue?.confidence === "certain").length,
    [data],
  );

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (leg !== "all" && row.currentLeg !== leg) {
          return false;
        }

        if (
          severity !== "all" &&
          formatPriorityTier(row.priority) !== severity
        ) {
          return false;
        }

        if (query.trim()) {
          const search = query.trim().toLowerCase();

          const haystack = Object.values(row)
            .flatMap((value) => {
              if (value == null) {
                return [];
              }

              if (Array.isArray(value)) {
                return value.map((item) =>
                  typeof item === "object" && item !== null
                    ? JSON.stringify(item)
                    : String(item),
                );
              }

              if (typeof value === "object") {
                return [JSON.stringify(value)];
              }

              return [String(value)];
            })
            .join(" ")
            .toLowerCase();

          if (!haystack.includes(search)) {
            return false;
          }
        }

        return true;
      }),
    [data, leg, severity, query],
  );

  return (
    <>
      <Reveal delay={0}>
        <AtRiskHeader
          totalCount={data.length}
          linkedCertainCount={linkedCertainCount}
          onExport={() => Utils.exportToCsv("at-risk.csv", filtered)}
          onRefresh={() => router.refresh()}
        />
      </Reveal>

      <AtRiskKpiGrid data={data} />

      <Reveal delay={0.15} className="mt-4">
        <AtRiskFilters
          severity={severity}
          leg={leg}
          query={query}
          severityCounts={severityCounts}
          legCounts={legCounts}
          onSeverityChange={setSeverity}
          onLegChange={setLeg}
          onQueryChange={setQuery}
        />
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
            description="Try clearing the severity, locus, or search filters."
          />
        ) : (
          filtered.map((row, index) => (
            <Reveal key={row.commitmentId} delay={Math.min(0.02 * index, 0.3)}>
              <AtRiskCard row={row} />
            </Reveal>
          ))
        )}
      </div>
      {data.length > 0 && (
        <Reveal delay={0.2} className="mt-4">
          <section className="p-4 mt-1 rounded bg-surface-container-lowest flex flex-col md:flex-row items-start md:items-center justify-between gap-1 flex-wrap">
            <div className="flex items-start gap-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-md text-on-surface font-semibold">
                  Why does this SLA number say what it says?
                </span>
                <p className="text-sm text-on-surface-variant max-w-4xl">
                  Calculations are strictly continuous and deterministic.
                  Elapsed ingests raw immutable timestamp events from Zendesk
                  tickets and Jira webhooks. Transit between queues does{" "}
                  <strong>NOT pause</strong> the SLA clock. Pauses are applied
                  solely if explicitly contracted scheduled maintenance windows
                  are active.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="font-mono text-xs text-outline">
                Engine: RFC-822 / UTC Strict
              </span>

              <Link
                href="/settings/sla/configuration"
                className="px-1 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary text-sm transition-colors"
              >
                View Clock Audit Schema
              </Link>
            </div>
          </section>
        </Reveal>
      )}
    </>
  );
};
