"use client";

import { Layers } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLeg } from "@/lib/format";
import type { BreachesByStageRow } from "@/lib/types/dashboard";

const LEG_COLORS: Record<string, string> = {
  support: "var(--leg-support)",
  engineering: "var(--leg-engineering)",
  waiting_customer: "var(--leg-waiting)",
  unknown: "var(--leg-unknown)",
};

export function BreachesByStageChart({ data }: { data: BreachesByStageRow[] }) {
  const chartData = data.map((row) => ({
    leg: row.leg,
    label: formatLeg(row.leg),
    count: row.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Breaches by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <EmptyState
              icon={Layers}
              title="No breaches to attribute"
              description="This will fill in once a commitment breaches."
            />
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  wrapperStyle={{
                    zIndex: 9999,
                  }}
                  cursor={{ fill: "var(--interactive)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const entry = payload[0]
                      ?.payload as (typeof chartData)[number];
                    const color = LEG_COLORS[entry.leg] ?? "var(--primary)";

                    return (
                      <div
                        className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md"
                        style={{ color }}
                      >
                        <div className="font-medium text-foreground">
                          {entry.label}
                        </div>
                        <div className="mt-1 font-semibold">
                          {entry.count} Breaches
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Breaches"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.leg} fill={LEG_COLORS[entry.leg]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
