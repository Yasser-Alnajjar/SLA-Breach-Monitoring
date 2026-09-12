"use client";

import { ShieldCheck } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BreachesOverTimePoint } from "@/lib/types/dashboard";

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function BreachesOverTimeChart({
  data,
  periodDays,
}: {
  data: BreachesOverTimePoint[];
  periodDays: number;
}) {
  const hasBreaches = data.some((point) => point.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breaches Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasBreaches ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={ShieldCheck}
              title="No breaches in this period"
              description={`Nothing has breached in the last ${periodDays} days.`}
            />
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayLabel}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  labelFormatter={(label) => formatDayLabel(String(label))}
                  formatter={(value) => [value, "Breaches"]}
                  contentStyle={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Breaches"
                  stroke="var(--destructive)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
