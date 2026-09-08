"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCommitmentKind, formatMinutes, formatPolicyMatch } from "@/lib/format";
import type { SlaPolicySummary } from "@/lib/types/integrations";

/** Edit form for one policy's targets — same shape as `EngineeringTargetForm`'s set/clear pattern, minus "clear" (a policy always needs targets). */
function PolicyTargetsForm({ policy, onCancel }: { policy: SlaPolicySummary; onCancel: () => void }) {
  const router = useRouter();
  const [minutesByKind, setMinutesByKind] = useState<Record<string, string>>(
    Object.fromEntries(policy.targets.map((t) => [t.kind, String(t.minutes)])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const targets = policy.targets.map((t) => ({ kind: t.kind, minutes: Number(minutesByKind[t.kind]) }));
    if (targets.some((t) => !Number.isFinite(t.minutes) || !Number.isInteger(t.minutes) || t.minutes <= 0)) {
      setError("Enter a positive whole number of minutes for each target");
      return;
    }

    setSaving(true);
    setError(null);

    const { ok, body } = await Actions.Integrations.overridePolicyTargets(policy.id, targets);
    setSaving(false);

    if (!ok) {
      setError(body.error ?? "Failed to save override");
      return;
    }

    onCancel();
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      {policy.targets.map((t) => (
        <div key={t.kind} className="flex items-center gap-2">
          <span className="w-28 text-sm text-muted-foreground">{formatCommitmentKind(t.kind)}</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={minutesByKind[t.kind] ?? ""}
            onChange={(e) => setMinutesByKind((prev) => ({ ...prev, [t.kind]: e.target.value }))}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save override"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function PolicyRow({ policy }: { policy: SlaPolicySummary }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {policy.name} <span className="font-normal text-muted-foreground">v{policy.version}</span>
          </p>
          <p className="text-xs text-muted-foreground">{formatPolicyMatch(policy.match)}</p>
        </div>
        <Badge variant="outline">{policy.imported ? "Imported" : "Manual"}</Badge>
      </div>

      {editing ? (
        <PolicyTargetsForm policy={policy} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {policy.targets.map((t) => `${formatCommitmentKind(t.kind)}: ${formatMinutes(t.minutes)}`).join(" · ")}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Override
          </Button>
        </div>
      )}
    </div>
  );
}

export function SlaPoliciesCard({ policies }: { policies: SlaPolicySummary[] }) {
  if (policies.length === 0) {
    return <p className="text-sm text-muted-foreground">No SLA policies imported yet.</p>;
  }

  return <div className="space-y-4">{policies.map((policy) => <PolicyRow key={policy.id} policy={policy} />)}</div>;
}
