"use client";

import {
  AlertTriangle,
  ChevronDown,
  Gauge,
  ListChecks,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCommitmentKind, formatMinutes } from "@/lib/format";
import type { DashboardData } from "@/lib/types/dashboard";
import { AtRiskList } from "./AtRiskList";

interface DashboardViewProps {
  data: DashboardData;
}

export const DashboardView = ({ data }: DashboardViewProps) => {
  const complianceTrend =
    data.compliance.current !== null && data.compliance.previous !== null
      ? data.compliance.current - data.compliance.previous
      : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Reveal delay={0}>
          <StatTile
            icon={AlertTriangle}
            label={`Breached · ${data.periodDays}d`}
            value={data.breachedThisPeriod.length}
            tone={
              data.breachedThisPeriod.length > 0 ? "destructive" : "default"
            }
          />
        </Reveal>
        <Reveal delay={0.05}>
          <StatTile
            icon={Gauge}
            label={`Compliance · ${data.periodDays}d`}
            value={
              data.compliance.current === null
                ? "—"
                : `${data.compliance.current}%`
            }
            tone="success"
            trend={
              complianceTrend !== null && (
                <span
                  className={
                    complianceTrend >= 0
                      ? "flex items-center gap-0.5 text-sm font-medium text-success"
                      : "flex items-center gap-0.5 text-sm font-medium text-destructive"
                  }
                >
                  {complianceTrend >= 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {Math.abs(Math.round(complianceTrend * 10) / 10)}pp
                </span>
              )
            }
          />
        </Reveal>
        <Reveal delay={0.1}>
          <StatTile
            icon={ListChecks}
            label="Aging in engineering"
            value={data.agingInEngineering.length}
          />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal delay={0.15} className="lg:col-span-2">
          <Card>
            <AtRiskList data={data.atRisk} />
            {data.atRiskOverflowCount > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                +{data.atRiskOverflowCount} more open commitment(s) not shown.
              </p>
            )}
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4">
          <Reveal delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle>Breached cases</CardTitle>
              </CardHeader>
              <CardContent>
                {data.breachedThisPeriod.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No breaches in the last {data.periodDays} days.
                  </p>
                ) : (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                      Show {data.breachedThisPeriod.length} breached case(s)
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                      {data.breachedThisPeriod.map((row, i) => (
                        <li
                          key={`${row.caseId}-${row.kind}-${i}`}
                          className="text-muted-foreground"
                        >
                          <span className="text-foreground">
                            {row.customerName ?? "—"}
                          </span>{" "}
                          ·{" "}
                          <a
                            href={`/cases/${row.caseId}`}
                            className="text-primary hover:underline"
                          >
                            #{row.externalId}
                          </a>{" "}
                          · {formatCommitmentKind(row.kind)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.25}>
            <Card>
              <CardHeader>
                <CardTitle>Aging in engineering</CardTitle>
              </CardHeader>
              <CardContent>
                {data.agingInEngineering.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing currently with engineering.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.agingInEngineering.map((row) => (
                      <li
                        key={row.caseId}
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <span>
                          <span className="text-foreground">
                            {row.customerName ?? "—"}
                          </span>{" "}
                          ·{" "}
                          <a
                            href={`/cases/${row.caseId}`}
                            className="text-primary hover:underline"
                          >
                            #{row.externalId}
                          </a>{" "}
                          · {formatMinutes(row.minutesInCurrentLeg)}
                        </span>
                        {row.legTarget && (
                          <>
                            <StatusBadge status={row.legTarget.status} />
                            <span className="text-xs">
                              {row.legTarget.remainingMinutes >= 0
                                ? `${formatMinutes(row.legTarget.remainingMinutes)} left`
                                : `over by ${formatMinutes(row.legTarget.breachedByMinutes ?? 0)}`}
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {data.agingOverflowCount > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    +{data.agingOverflowCount} more.
                  </p>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
};
