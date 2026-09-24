"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import { Activity, RefreshCw, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Actions } from "@/actions/client";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/shared/reveal";
import { formatExactTimestamp } from "@/lib/format";
import {
  ACTIVE_POLL_OPTIONS,
  RECONCILIATION_OPTIONS,
  type WorkerMonitoringData,
  type WorkerStatus,
} from "@/lib/types/worker-settings";
import { IntervalSettingRow } from "./IntervalSettingRow";

const STATUS_LABEL: Record<WorkerStatus, string> = {
  running: "Running",
  degraded: "Degraded",
  stopped: "Stopped",
};

const STATUS_VARIANT: Record<WorkerStatus, BadgeProps["variant"]> = {
  running: "success",
  degraded: "warning",
  stopped: "destructive",
};

interface MonitoringViewProps {
  data: WorkerMonitoringData;
}

/**
 * Worker/Monitoring settings — the active-set poll and reconciliation sweep
 * intervals that drive `apps/worker`'s two-speed scheduler, plus its
 * observed run status. Global, not per-organization: one worker process
 * polls every organization on the platform on these same two timers (see
 * `@sla/db`'s `WorkerSettings` doc comment) — every signed-in user can view
 * this page, but only an organization owner (`data.canEdit`) can change it.
 */
export function MonitoringView({ data }: MonitoringViewProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(data);

  useEffect(() => {
    setSettings(data);
  }, [data]);

  async function saveActivePoll(activePollIntervalMs: number) {
    const { ok, body } = await Actions.WorkerSettings.save({
      activePollIntervalMs,
      reconciliationIntervalMs: settings.reconciliationIntervalMs,
    });
    if (ok) {
      setSettings(body);
      router.refresh();
      return { ok: true as const };
    }
    return { ok: false as const, error: body.error };
  }

  async function saveReconciliation(reconciliationIntervalMs: number) {
    const { ok, body } = await Actions.WorkerSettings.save({
      activePollIntervalMs: settings.activePollIntervalMs,
      reconciliationIntervalMs,
    });
    if (ok) {
      setSettings(body);
      router.refresh();
      return { ok: true as const };
    }
    return { ok: false as const, error: body.error };
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        eyebrow="Audit trail & daemon verification"
        title="Monitoring & Sync Health"
        description="How often the worker checks SLA commitments — separate from the nightly integrity check."
      />

      <Reveal delay={0}>
        <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
                <Timer className="size-4" />
              </span>
              <div>
                <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                  Polling intervals
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {settings.canEdit
                    ? "Changes apply on the worker's next tick — no restart required."
                    : "View only — ask an organization owner to change these."}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="divide-y px-5 py-0">
            <IntervalSettingRow
              label="Active monitoring"
              description="Checks active cases with live SLA commitments."
              valueMs={settings.activePollIntervalMs}
              options={ACTIVE_POLL_OPTIONS}
              canEdit={settings.canEdit}
              onSave={saveActivePoll}
            />
            <IntervalSettingRow
              label="Reconciliation"
              description="Periodically verifies recent changes and catches missed updates."
              valueMs={settings.reconciliationIntervalMs}
              options={RECONCILIATION_OPTIONS}
              canEdit={settings.canEdit}
              onSave={saveReconciliation}
            />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
                <Activity className="size-4" />
              </span>
              <div>
                <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                  Worker status
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Reported by the worker process itself, not this page.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid grid-cols-2 gap-4 p-6 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-on-surface-variant">Status</p>
              <Badge variant={STATUS_VARIANT[settings.status]} className="mt-1">
                {STATUS_LABEL[settings.status]}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Last active check</p>
              <p className="mt-1.5 text-sm font-medium">
                {formatExactTimestamp(settings.lastActivePollAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Next active check</p>
              <p className="mt-1.5 text-sm font-medium">
                {settings.nextActivePollAt
                  ? formatExactTimestamp(settings.nextActivePollAt)
                  : "Pending first check"}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">
                Last reconciliation
              </p>
              <p className="mt-1.5 text-sm font-medium">
                {formatExactTimestamp(settings.lastReconciliationAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">
                Next reconciliation
              </p>
              <p className="mt-1.5 text-sm font-medium">
                {settings.nextReconciliationAt
                  ? formatExactTimestamp(settings.nextReconciliationAt)
                  : "Pending first check"}
              </p>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Button
        type="button"
        variant="link"
        onClick={() => router.refresh()}
        className="h-auto gap-1.5 p-0 text-xs font-normal text-on-surface-variant underline-offset-0 hover:text-foreground hover:no-underline [&_svg]:size-3"
      >
        <RefreshCw className="size-3" />
        Refresh status
      </Button>
    </div>
  );
}
