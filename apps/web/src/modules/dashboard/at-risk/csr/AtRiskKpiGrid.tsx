"use client";

import {
  AlertTriangle,
  Clock,
  Network,
  Timer,
  CirclePause,
} from "lucide-react";
import { useMemo } from "react";

import { Reveal } from "@/components/shared/reveal";
import { formatMinutes } from "@/lib/format";
import type { AtRiskRowData } from "@/lib/types/at-risk";

import { AtRiskKpiTile } from "./AtRiskKpiTile";

const IMMEDIATE_THREAT_MINUTES = 60;
const ELEVATED_RISK_MINUTES = 150;

type AtRiskKpiGridProps = {
  data: AtRiskRowData[];
};

export const AtRiskKpiGrid = ({ data }: AtRiskKpiGridProps) => {
  const immediateThreat = useMemo(
    () => data.filter((row) => row.remainingMinutes < IMMEDIATE_THREAT_MINUTES),
    [data],
  );

  const elevatedRisk = useMemo(
    () =>
      data.filter(
        (row) =>
          row.remainingMinutes >= IMMEDIATE_THREAT_MINUTES &&
          row.remainingMinutes < ELEVATED_RISK_MINUTES,
      ),
    [data],
  );

  const engineeringCount = useMemo(
    () => data.filter((row) => row.currentLeg === "engineering").length,
    [data],
  );

  const avgMinutesInLeg = useMemo(
    () =>
      data.length > 0
        ? data.reduce((sum, row) => sum + row.minutesInCurrentLeg, 0) /
          data.length
        : null,
    [data],
  );

  const immediateThreatDetail =
    immediateThreat.length > 0
      ? immediateThreat
          .slice(0, 3)
          .map((row) => `${row.customerName ?? "Unknown"} #${row.externalId}`)
          .join(", ")
      : "No cases below the critical runway threshold";

  const elevatedRiskDetail =
    elevatedRisk.length > 0
      ? elevatedRisk
          .slice(0, 3)
          .map((row) => `${row.customerName ?? "Unknown"} #${row.externalId}`)
          .join(", ")
      : "No cases currently approaching the threshold";

  const locusDetail =
    data.length > 0
      ? `${engineeringCount} of ${data.length} case${
          data.length !== 1 ? "s" : ""
        }`
      : "No open commitments";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Reveal delay={0.02}>
        <AtRiskKpiTile
          icon={AlertTriangle}
          label="Immediate Threat (< 1h Runway)"
          value={`${immediateThreat.length} Cases`}
          qualifier="Critical Threshold"
          tone={immediateThreat.length > 0 ? "destructive" : "default"}
          detail={immediateThreatDetail}
        />
      </Reveal>

      <Reveal delay={0.05}>
        <AtRiskKpiTile
          icon={Clock}
          label="Elevated Risk (1h – 2.5h)"
          value={`${elevatedRisk.length} Cases`}
          qualifier="Approaching"
          tone={elevatedRisk.length > 0 ? "warning" : "default"}
          detail={elevatedRiskDetail}
        />
      </Reveal>

      <Reveal delay={0.08}>
        <AtRiskKpiTile
          icon={Network}
          label="Active Clock Locus"
          value={
            data.length > 0
              ? `${Math.round((engineeringCount / data.length) * 100)}% Eng Leg`
              : "—"
          }
          qualifier={locusDetail}
          tone="default"
          detail="Clock burning inside Jira queues without resolution"
        />
      </Reveal>

      <Reveal delay={0.1}>
        <AtRiskKpiTile
          icon={CirclePause}
          label="Avg Transit Latency"
          value={
            avgMinutesInLeg !== null ? formatMinutes(avgMinutesInLeg) : "—"
          }
          qualifier="+18m vs baseline"
          tone="success"
          detail="Unassigned in Eng triage backlogs"
        />
      </Reveal>
    </div>
  );
};
