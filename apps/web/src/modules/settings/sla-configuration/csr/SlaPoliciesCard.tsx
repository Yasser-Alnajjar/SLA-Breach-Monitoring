"use client";

import {
  Loader2,
  Plus,
  ShieldCheck,
  History,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  formatCommitmentKind,
  formatMinutes,
  formatPolicyMatch,
} from "@/lib/format";
import type {
  BusinessCalendarOption,
  CustomerCalendarSummary,
  SlaPolicySummary,
} from "@/lib/types/sla-configuration";
import { SlaSection, formatTargetClock } from "./SlaSection";
import { NativePolicyDialog } from "./NativePolicyDialog";
import { PolicyOverrideDialog } from "./PolicyOverrideDialog";

const chip =
  "bg-surface-container-highest rounded px-1.5 py-0.5 font-mono text-xxs";

function TargetGrid({
  targets,
  baseline,
}: {
  targets: SlaPolicySummary["targets"];
  baseline?: SlaPolicySummary["targets"];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {targets.map((target) => {
        const original = baseline?.find((b) => b.kind === target.kind);
        const changed = original && original.minutes !== target.minutes;

        return (
          <div
            key={target.kind}
            className="bg-surface-container-lowest flex flex-col gap-0.5 rounded-lg p-2.5"
          >
            <span className="text-outline font-mono text-xxs uppercase">
              {formatCommitmentKind(target.kind)}
            </span>
            <span className="text-primary font-mono text-base font-bold">
              {formatTargetClock(target.minutes)}
            </span>
            {changed && (
              <span className="text-outline font-mono text-xxs line-through">
                {formatTargetClock(original.minutes)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PolicyRow({
  policy,
  businessCalendars,
  customers,
  defaultCalendarId,
  onSaved,
}: {
  policy: SlaPolicySummary;
  businessCalendars: BusinessCalendarOption[];
  customers: CustomerCalendarSummary[];
  defaultCalendarId: string | null;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  async function handleToggleActive() {
    setTogglingActive(true);

    const { ok } = await Actions.SlaConfiguration.setPolicyActive(
      policy.id,
      !policy.active,
    );

    setTogglingActive(false);

    if (ok) onSaved();
  }

  return (
    <>
      <div className="bg-surface-container hover:bg-surface-container-high/50 flex flex-col gap-3 rounded-lg p-4 transition-colors">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-on-surface text-base font-semibold">
              {policy.name}
            </p>

            <span className={`${chip} text-on-surface-variant`}>
              v{policy.version}
            </span>

            <span
              className={`${chip} ${policy.source === "imported" ? "text-secondary" : "text-primary"}`}
            >
              {policy.source === "imported" ? "Imported (Zendesk)" : "Native"}
            </span>

            {policy.overridden && (
              <span className={`${chip} text-warning font-semibold`}>
                ▲ Overridden
              </span>
            )}

            {policy.active ? (
              <span className={`${chip} text-success flex items-center gap-1`}>
                <span className="bg-success size-1.5 rounded-full" />
                Active
              </span>
            ) : (
              <span className={`${chip} text-warning`}>Inactive</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-primary"
              onClick={() => setDialogOpen(true)}
            >
              {policy.source === "native" || policy.overridden
                ? "Edit"
                : "Override targets"}
            </Button>

            {policy.source === "native" && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={policy.active ? "text-error" : "text-success"}
                onClick={handleToggleActive}
                disabled={togglingActive}
              >
                {togglingActive && <Loader2 className="animate-spin" />}
                {policy.active ? "Deactivate" : "Reactivate"}
              </Button>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest flex items-center gap-2 overflow-x-auto rounded px-2.5 py-1.5">
          <span className="text-outline shrink-0 font-mono text-xxs">
            MATCH RULE:
          </span>
          <code className="text-secondary truncate font-mono text-xs">
            {formatPolicyMatch(policy.match)}
          </code>
        </div>

        <TargetGrid
          targets={policy.targets}
          baseline={policy.overridden ? policy.importedTargets : undefined}
        />
      </div>

      {policy.source === "imported" ? (
        <PolicyOverrideDialog
          policy={policy}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={() => {
            setDialogOpen(false);
            onSaved();
          }}
        />
      ) : (
        <NativePolicyDialog
          mode="edit"
          policy={policy}
          businessCalendars={businessCalendars}
          customers={customers}
          defaultCalendarId={defaultCalendarId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={() => {
            setDialogOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}

export function SlaPoliciesCard({
  policies,
  businessCalendars,
  customers,
  defaultCalendarId,
}: {
  policies: SlaPolicySummary[];
  businessCalendars: BusinessCalendarOption[];
  customers: CustomerCalendarSummary[];
  defaultCalendarId: string | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  const activePolicies = policies.filter((policy) => policy.active);
  const archivedPolicies = policies.filter((policy) => !policy.active);

  return (
    <SlaSection
      delay={0.05}
      icon={<SlidersHorizontal className="size-5" />}
      title="SLA Policies & Metric Matrix"
      meta={`${activePolicies.length} published`}
      metaClassName="text-success"
      subtitle="Imported (Zendesk) policies are matched first; native policies only when none match (D12). Every edit creates a new version."
      action={
        <Button
          type="button"
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={businessCalendars.length === 0}
          title={
            businessCalendars.length === 0
              ? "No business calendar available yet"
              : undefined
          }
        >
          <Plus />
          New native policy
        </Button>
      }
    >
      {policies.length === 0 ? (
        <p className="text-on-surface-variant text-sm">
          No SLA policies yet — import from Zendesk or create a native policy.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Active policies */}
          {activePolicies.length > 0 && (
            <div className="space-y-3">
              {activePolicies.map((policy) => (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  businessCalendars={businessCalendars}
                  customers={customers}
                  defaultCalendarId={defaultCalendarId}
                  onSaved={() => router.refresh()}
                />
              ))}
            </div>
          )}

          {/* Archived policies */}
          {archivedPolicies.length > 0 && (
            <Accordion
              type="single"
              collapsible
              className="bg-surface-container overflow-hidden rounded-lg"
            >
              <AccordionItem value="archived" className="border-0">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <History className="text-outline size-4" />
                    <span className="text-sm font-medium">
                      Archived &amp; superseded policies (
                      {archivedPolicies.length})
                    </span>
                    <span className={`${chip} text-secondary`}>
                      IMMUTABLE LOG
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4">
                  <div className="space-y-3 pt-2">
                    <div className="bg-surface-container-lowest text-on-surface-variant flex items-start gap-2 rounded p-3 text-xs">
                      <ShieldCheck className="text-secondary mt-0.5 size-4 shrink-0" />
                      Every edit creates an immutable new policy version.
                      Existing commitments stay tied to the version they were
                      created under.
                    </div>
                    {archivedPolicies.map((policy) => (
                      <PolicyRow
                        key={policy.id}
                        policy={policy}
                        businessCalendars={businessCalendars}
                        customers={customers}
                        defaultCalendarId={defaultCalendarId}
                        onSaved={() => router.refresh()}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}

      <NativePolicyDialog
        mode="create"
        businessCalendars={businessCalendars}
        customers={customers}
        defaultCalendarId={defaultCalendarId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => {
          setCreateOpen(false);
          router.refresh();
        }}
      />
    </SlaSection>
  );
}
