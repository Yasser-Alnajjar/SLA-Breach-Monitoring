"use client";

import { Gauge } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/shared/empty-state";
import type { ComplianceTrendPoint } from "@/lib/types/dashboard";

/**
 * Stitch's "SLA Compliance Trend" chart: a genuinely new time series (no
 * compliance history existed anywhere before this reconstruction — see
 * `computeComplianceTrend`). Stitch's mockup also draws a dashed "95%
 * Benchmark" reference line, but no org-level compliance target exists in
 * the data model (unlike the analogous, real `engineeringLegTargetMinutes`)
 * — rather than fabricate that number, this chart omits the benchmark line
 * and says so, showing only real peak/current/low figures.
 */
export function SlaComplianceTrendChart({
  data,
  currentCompliance,
}: {
  data: ComplianceTrendPoint[];
  currentCompliance: number | null;
}) {
  const values = data
    .map((p) => p.compliancePercent)
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return (
      <div className="bg-surface-container-low shadow-soft flex h-full flex-col justify-between rounded-xl p-4">
        <h3 className="text-on-surface text-base font-medium">SLA Compliance Trend</h3>
        <div className="flex h-48 items-center justify-center">
          <EmptyState
            icon={Gauge}
            title="No trend yet"
            description="Appears once commitments start closing in this period."
          />
        </div>
      </div>
    );
  }

  const peak = Math.max(...values);
  const low = Math.min(...values);

  return (
    <div className="bg-surface-container-low shadow-soft flex h-full flex-col justify-between rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-on-surface text-base font-medium">SLA Compliance Trend</h3>
          <p className="text-outline text-sm">Trailing 7-day compliance rate</p>
        </div>
        <span className="bg-surface-container-highest text-on-surface-variant rounded px-2 py-0.5 font-mono text-xxs">
          No target configured
        </span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              formatter={(value) => [value === null ? "—" : `${value}%`, "Compliance"]}
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
              dataKey="compliancePercent"
              name="Compliance"
              stroke="var(--warning)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-outline border-surface-container-highest/60 flex items-center justify-between border-t pt-2 font-mono text-xxs">
        <span>{peak}% peak</span>
        <span className="font-medium text-warning">
          Current: {currentCompliance !== null ? `${currentCompliance}%` : "—"}
        </span>
        <span>{low}% low</span>
      </div>
    </div>
  );
}
