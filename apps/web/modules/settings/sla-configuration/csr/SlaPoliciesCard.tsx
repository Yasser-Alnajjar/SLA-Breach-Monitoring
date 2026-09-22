"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import { NativePolicyDialog } from "./NativePolicyDialog";
import { PolicyOverrideDialog } from "./PolicyOverrideDialog";

function formatTargets(targets: SlaPolicySummary["targets"]): string {
  return targets
    .map(
      (target) =>
        `${formatCommitmentKind(target.kind)}: ${formatMinutes(target.minutes)}`,
    )
    .join(" · ");
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
      <div className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {policy.name}
              </p>

              <span className="text-xs text-muted-foreground">
                v{policy.version}
              </span>

              {policy.source === "imported" ? (
                <Badge variant="outline">
                  {policy.overridden ? "Overridden" : "Imported"}
                </Badge>
              ) : (
                <Badge variant="secondary">Native</Badge>
              )}

              {!policy.active && <Badge variant="warning">Inactive</Badge>}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatPolicyMatch(policy.match)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {policy.source === "native" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleToggleActive}
                disabled={togglingActive}
              >
                {togglingActive && <Loader2 className="animate-spin" />}
                {policy.active ? "Deactivate" : "Reactivate"}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              {policy.source === "native"
                ? "Edit"
                : policy.overridden
                  ? "Edit"
                  : "Override"}
            </Button>
          </div>
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Current targets</p>

          <p className="mt-1 text-sm text-foreground">
            {formatTargets(policy.targets)}
          </p>

          {policy.overridden && (
            <p className="mt-1 text-xs text-muted-foreground">
              {policy.source === "imported" ? "Imported" : "Original"}:{" "}
              {formatTargets(policy.importedTargets)}
            </p>
          )}
        </div>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-3xl text-xs text-muted-foreground">
          Imported policies come from Zendesk and are matched first. Native
          policies are matched only when no imported policy matches (D12).
        </p>

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
          Create policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No SLA policies yet — import from Zendesk or create a native policy.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Active policies */}
          {activePolicies.length > 0 && (
            <div className="space-y-4">
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
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="archived">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Archived</span>

                    <Badge variant="outline">{archivedPolicies.length}</Badge>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="space-y-4 pt-2">
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
    </div>
  );
}
