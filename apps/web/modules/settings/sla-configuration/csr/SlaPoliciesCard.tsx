"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCommitmentKind,
  formatMinutes,
  formatPolicyMatch,
} from "@/lib/format";
import type { SlaPolicySummary } from "@/lib/types/sla-configuration";
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
  onSaved,
}: {
  policy: SlaPolicySummary;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

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

              <Badge variant="outline">
                {policy.overridden ? "Overridden" : "Imported"}
              </Badge>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {formatPolicyMatch(policy.match)}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
          >
            {policy.overridden ? "Edit" : "Override"}
          </Button>
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Current targets</p>

          <p className="mt-1 text-sm text-foreground">
            {formatTargets(policy.targets)}
          </p>

          {policy.overridden && (
            <p className="mt-1 text-xs text-muted-foreground">
              Imported: {formatTargets(policy.importedTargets)}
            </p>
          )}
        </div>
      </div>

      <PolicyOverrideDialog
        policy={policy}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          setDialogOpen(false);
          onSaved();
        }}
      />
    </>
  );
}

export function SlaPoliciesCard({
  policies,
}: {
  policies: SlaPolicySummary[];
}) {
  const router = useRouter();

  if (policies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No SLA policies imported yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {policies.map((policy) => (
        <PolicyRow
          key={policy.id}
          policy={policy}
          onSaved={() => router.refresh()}
        />
      ))}
    </div>
  );
}
