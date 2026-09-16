"use client";

import { Download } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import type { ProjectAnalyticsData } from "@/lib/types/dashboard";
import { BreachesByStageChart } from "./BreachesByStageChart";
import { BreachesOverTimeChart } from "./BreachesOverTimeChart";
import { SlaComplianceChart } from "./SlaComplianceChart";

export function ProjectAnalyticsSection({
  data,
  periodDays,
}: {
  data: ProjectAnalyticsData;
  periodDays: number;
}) {
  return (
    <section className="mt-4">
      <Reveal delay={0.12} className="flex items-center justify-between gap-2">
        <SectionHeading>SLA Analytics</SectionHeading>
        {/* A plain anchor, not next/link: the route answers with a CSV attachment, not a page. */}
        <Button asChild size="sm" variant="outline">
          <a href="/api/reports/commitments" download>
            <Download className="size-3.5" />
            Export full report
          </a>
        </Button>
      </Reveal>

      <div className="mt-3 flex flex-col gap-4">
        <Reveal delay={0.14}>
          <BreachesOverTimeChart data={data.breachesOverTime} periodDays={periodDays} />
        </Reveal>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal delay={0.16}>
            <SlaComplianceChart data={data.compliance} />
          </Reveal>
          <Reveal delay={0.18}>
            <BreachesByStageChart data={data.breachesByStage} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
