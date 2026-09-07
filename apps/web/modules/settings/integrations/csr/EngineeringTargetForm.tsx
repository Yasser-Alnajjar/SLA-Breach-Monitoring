"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMinutes } from "@/lib/format";

/** Set/clear form for the org-wide engineering-leg OLA target (roadmap step 16). */
export function EngineeringTargetForm({ initialTargetMinutes }: { initialTargetMinutes: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(initialTargetMinutes === null);
  const [hours, setHours] = useState(
    initialTargetMinutes !== null ? String(Math.round(initialTargetMinutes / 60)) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsedHours = Number(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setError("Enter a positive number of hours");
      return;
    }

    setSaving(true);
    setError(null);

    const { ok, body } = await Actions.Integrations.setEngineeringTarget(Math.round(parsedHours * 60));
    setSaving(false);

    if (!ok) {
      setError(body.error ?? "Failed to save target");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function handleClear() {
    setSaving(true);
    setError(null);

    const { ok } = await Actions.Integrations.clearEngineeringTarget();
    setSaving(false);

    if (!ok) {
      setError("Failed to clear target");
      return;
    }

    setHours("");
    setEditing(true);
    router.refresh();
  }

  if (!editing && initialTargetMinutes !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Target: <span className="text-foreground">{formatMinutes(initialTargetMinutes)}</span>
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Change
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleClear} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Clear
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min={1}
        step={1}
        placeholder="Hours"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-24"
      />
      <span className="text-sm text-muted-foreground">hours</span>
      <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        {saving ? "Saving…" : "Set target"}
      </Button>
      {initialTargetMinutes !== null && (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      )}
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
