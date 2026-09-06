"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { BackfillResult, NormalizationResult } from "@sla/zendesk";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SyncResult {
  backfill: BackfillResult;
  normalization: NormalizationResult;
}

export function ZendeskConnectForm() {
  const [subdomain, setSubdomain] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    window.location.href = `/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(subdomain)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="zendesk-subdomain">Zendesk subdomain</Label>
        <div className="flex items-center gap-2">
          <Input
            id="zendesk-subdomain"
            value={subdomain}
            onChange={(event) => setSubdomain(event.target.value)}
            placeholder="acme"
            pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*"
            required
            className="max-w-40"
          />
          <span className="text-sm text-muted-foreground">.zendesk.com</span>
        </div>
      </div>
      <Button type="submit" size="sm">
        Connect Zendesk
      </Button>
    </form>
  );
}

interface ZendeskBackfillButtonProps {
  /** Needed to send the user back through /connect without retyping it. */
  subdomain: string;
  /** True when the stored credentials already carry `reauthRequired` (checked on the server before this renders). */
  initialReauthRequired?: boolean;
}

export function ZendeskBackfillButton({ subdomain, initialReauthRequired = false }: ZendeskBackfillButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(initialReauthRequired);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/integrations/zendesk/backfill", { method: "POST" });
    const body = await response.json();
    setRunning(false);

    if (!response.ok) {
      if (body.reauthRequired) {
        setReauthRequired(true);
      } else {
        setError(body.error ?? "Backfill failed");
      }
      return;
    }

    setResult(body as SyncResult);
    router.refresh();
  }

  if (reauthRequired) {
    return <ReauthBanner subdomain={subdomain} />;
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={running}>
        {running && <Loader2 className="animate-spin" />}
        {running ? "Running backfill…" : "Run backfill"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            {result.backfill.ticketsFetched} tickets · {result.backfill.ticketAuditsFetched} ticket events ·{" "}
            {result.backfill.organizationsFetched} organizations · {result.backfill.slaPoliciesFetched} SLA
            policies.
          </p>
          <p>
            {result.normalization.casesUpserted} cases · {result.normalization.customersUpserted} customers ·{" "}
            {result.normalization.normalizedEventsWritten} normalized events.
            {result.normalization.ticketsFailed.length > 0 &&
              ` ${result.normalization.ticketsFailed.length} ticket(s) failed to normalize.`}
          </p>
        </div>
      )}
    </div>
  );
}
