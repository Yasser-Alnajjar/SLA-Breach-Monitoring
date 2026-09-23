"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ZendeskSyncResult } from "@/lib/types/integrations";

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
          <span className="text-sm text-on-surface-variant">.zendesk.com</span>
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

export function ZendeskBackfillButton({
  subdomain,
  initialReauthRequired = false,
}: ZendeskBackfillButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ZendeskSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(initialReauthRequired);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const { ok, body } = await Actions.Integrations.runZendeskBackfill();
    setRunning(false);

    if (!ok) {
      if (body.reauthRequired) {
        setReauthRequired(true);
      } else {
        setError(body.error ?? "Backfill failed");
      }
      return;
    }

    setResult(body);
    router.refresh();
  }

  if (reauthRequired) {
    return (
      <ReauthBanner
        provider="Zendesk"
        reconnectHref={`/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(subdomain)}`}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-3">
      <Button
        type="button"
        size="sm"
        variant="surface"
        onClick={handleClick}
        disabled={running}
      >
        {running && <Loader2 className="animate-spin" />}
        {running ? "Running backfill…" : "Run backfill"}
      </Button>

      {error && (
        <Alert variant="destructive" className="w-full max-w-full">
          <AlertCircle />
          <AlertDescription className="min-w-0 wrap-break-word">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="w-full min-w-0 space-y-1 text-sm text-on-surface-variant">
          <p className="wrap-break-word">
            {result.backfill.ticketsFetched} tickets ·{" "}
            {result.backfill.ticketAuditsFetched} ticket events ·{" "}
            {result.backfill.organizationsFetched} organizations ·{" "}
            {result.backfill.slaPoliciesFetched} SLA policies.
          </p>

          <p className="wrap-break-word">
            {result.normalization.casesUpserted} cases ·{" "}
            {result.normalization.customersUpserted} customers ·{" "}
            {result.normalization.normalizedEventsWritten} normalized events.
            {result.normalization.ticketsFailed.length > 0 &&
              ` ${result.normalization.ticketsFailed.length} ticket(s) failed to normalize.`}
          </p>
        </div>
      )}
    </div>
  );
}
