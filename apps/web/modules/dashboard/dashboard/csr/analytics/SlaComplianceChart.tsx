"use client";

import { Gauge } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlaComplianceBreakdown } from "@/lib/types/dashboard";

const SEGMENTS = [
  { key: "metSla", label: "Met SLA", color: "var(--success)" },
  { key: "atRisk", label: "At Risk", color: "var(--warning)" },
  { key: "breached", label: "Breached", color: "var(--destructive)" },
] as const;

export function SlaComplianceChart({ data }: { data: SlaComplianceBreakdown }) {
  const chartData = SEGMENTS.map((segment) => ({
    key: segment.key,
    name: segment.label,
    value: data[segment.key],
    color: segment.color,
  })).filter((segment) => segment.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Compliance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.total === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={Gauge}
              title="No tracked cases yet"
              description="Compliance will appear once cases have SLA commitments."
            />
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-6 sm:flex-row">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="65%"
                    outerRadius="100%"
                    paddingAngle={chartData.length > 1 ? 3 : 0}
                    stroke="none"
                  >
                    {chartData.map((segment) => (
                      <Cell key={segment.key} fill={segment.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} (${Math.round((Number(value) / data.total) * 100)}%)`,
                      name,
                    ]}
                    wrapperStyle={{
                      zIndex: 9999,
                    }}
                    contentStyle={{
                      background: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-medium tracking-tight">
                  {data.total}
                </span>
                <span className="text-xs text-muted-foreground">cases</span>
              </div>
            </div>

            <div className="flex w-full flex-1 flex-col gap-2 text-sm">
              {SEGMENTS.map((segment) => {
                const value = data[segment.key];
                const percent = Math.round((value / data.total) * 100);
                return (
                  <div
                    key={segment.key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      {segment.label}
                    </span>
                    <span className="font-medium text-foreground">
                      {value}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({percent}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
