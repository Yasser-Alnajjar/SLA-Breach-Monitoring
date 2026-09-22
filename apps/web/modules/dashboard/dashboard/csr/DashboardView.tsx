"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronDown,
  Gauge,
  ListChecks,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { caseCommitmentHref } from "@/lib/case-links";
import { formatCommitmentKind, formatMinutes } from "@/lib/format";
import type { DashboardData } from "@/lib/types/dashboard";
import { AtRiskList } from "./AtRiskList";
import { ProjectAnalyticsSection } from "./analytics/ProjectAnalyticsSection";

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
      {data.cycleTimeAnomalies.length > 0 && (
        <Reveal delay={0} className="mb-4">
          <Alert variant="warning">
            <AlertTriangle />
            <AlertDescription>
              <AlertTitle>Unusual cycle times</AlertTitle>
              <ul className="mt-2 space-y-1">
                {data.cycleTimeAnomalies.map((row, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">
                      {row.customerName}
                    </span>{" "}
                    · {formatCommitmentKind(row.kind)} is running{" "}
                    <span className="font-medium">{row.direction}</span> than
                    usual: recent median{" "}
                    {formatMinutes(row.recentMedianMinutes)} vs. baseline{" "}
                    {formatMinutes(row.baselineMedianMinutes)} (
                    {row.recentCount} recent of {row.baselineCount} historical
                    cases).
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Reveal delay={0.02}>
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

      <ProjectAnalyticsSection
        data={data.analytics}
        periodDays={data.periodDays}
      />

      <div className="mt-4">
        <Reveal delay={0.3}>
          <SectionHeading>Operational Attention</SectionHeading>
        </Reveal>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Reveal delay={0.32} className="lg:col-span-2">
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
            <Reveal delay={0.34}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Breached cases</CardTitle>
                </CardHeader>

                <CardContent>
                  {data.breachedThisPeriod.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No breaches in the last {data.periodDays} days.
                    </p>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="cursor-pointer text-sm flex w-full justify-between text-muted-foreground">
                          <span>
                            {data.breachedThisPeriod.length} breached case
                            {data.breachedThisPeriod.length !== 1 ? "s" : ""}
                          </span>

                          <span>View cases →</span>
                        </div>
                      </DialogTrigger>

                      <DialogContent className="max-w-3xl ">
                        <DialogHeader>
                          <DialogTitle>
                            Breached cases · {data.periodDays}d
                          </DialogTitle>
                        </DialogHeader>

                        <div className="max-h-[60vh] overflow-y-auto">
                          <ul className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                            {data.breachedThisPeriod.map((row, i) => (
                              <li
                                key={`${row.commitmentId}-${i}`}
                                className="text-muted-foreground flex"
                              >
                                <span className="text-foreground">
                                  {row.customerName ?? "—"}
                                </span>{" "}
                                ·{" "}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={caseCommitmentHref(row.caseId, row.commitmentId)}
                                      className="text-primary hover:underline truncate max-w-lg block"
                                    >
                                      {row.subject ?? `#${row.externalId}`}
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {row.subject ?? `#${row.externalId}`}
                                  </TooltipContent>
                                </Tooltip>{" "}
                                · {formatCommitmentKind(row.kind)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={0.36}>
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
      </div>
    </>
  );
};
