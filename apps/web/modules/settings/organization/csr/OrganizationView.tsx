"use client";

import { AlertCircle, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/shared/reveal";
import { TimezoneCombobox } from "@/components/shared/timezone-combobox";
import type { OrganizationSettingsData } from "@/lib/types/organization";

interface OrganizationViewProps {
  data: OrganizationSettingsData;
}

interface SaveResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/**
 * Organization settings (roadmap 5.8): name and a display timezone, used
 * only to group days on the dashboard (roadmap 6.5) — never read by SLA
 * calculations, which stay pinned to each calendar's own timezone. Editing
 * is owner-only (`data.canEdit`); every other signed-in member gets a
 * read-only view, matching Monitoring's convention.
 */
export function OrganizationView({ data }: OrganizationViewProps) {
  const router = useRouter();
  const [name, setName] = useState(data.name);
  const [timezone, setTimezone] = useState(data.timezone);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const trimmedName = name.trim();
  const dirty = trimmedName !== data.name || timezone !== data.timezone;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmedName) return;

    setSaving(true);
    setResult(null);

    const { ok, body } = await Actions.Organization.update({ name: trimmedName, timezone });

    setSaving(false);

    if (!ok) {
      setResult({ ok: false, error: body.error ?? "Failed to update organization" });
      return;
    }

    setName(body.name);
    setTimezone(body.timezone);
    setResult({ ok: true, message: "Organization updated." });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Organization</h2>
        <p className="text-sm text-muted-foreground">
          Manage this organization's name and display timezone.
        </p>
      </div>

      <Reveal delay={0}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                <Building2 className="size-4" />
              </span>
              <div>
                <CardTitle className="text-sm font-semibold">
                  Organization details
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.canEdit
                    ? "The timezone only groups days on the dashboard — it's never used in SLA calculations."
                    : "View only — ask an organization owner to change these."}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-5 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="organization-name">Name</Label>
                <Input
                  id="organization-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Organization name"
                  required
                  maxLength={200}
                  disabled={!data.canEdit || saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="organization-timezone">Display timezone</Label>
                <TimezoneCombobox
                  id="organization-timezone"
                  value={timezone}
                  onChange={setTimezone}
                  disabled={!data.canEdit || saving}
                />
              </div>

              {result && (
                <Alert variant={result.ok ? "success" : "destructive"}>
                  {result.ok ? <CheckCircle2 /> : <AlertCircle />}
                  <AlertDescription>
                    {result.ok ? result.message : result.error}
                  </AlertDescription>
                </Alert>
              )}

              {data.canEdit && (
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!dirty || saving || !trimmedName}>
                    {saving && <Loader2 className="animate-spin" />}
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
