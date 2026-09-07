"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { LinearBackfillResult } from "@/lib/types/integrations";

export function LinearConnectButton() {
  return (
    <Button type="button" size="sm" onClick={() => (window.location.href = "/api/integrations/linear/connect")}>
      Connect Linear
    </Button>
  );
}

export function LinearBackfillButton({ initialReauthRequired = false }: { initialReauthRequired?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LinearBackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(initialReauthRequired);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const { ok, body } = await Actions.Integrations.runLinearBackfill();
    setRunning(false);

    if (!ok) {
      if (body.reauthRequired) {
        setReauthRequired(true);
      } else {
        setError(body.error ?? "Backfill failed");
      }
      return;
    }

    setResult(body.backfill);
    router.refresh();
  }

  if (reauthRequired) {
    return <ReauthBanner provider="Linear" reconnectHref="/api/integrations/linear/connect" />;
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
        <p className="text-sm text-muted-foreground">
          {result.issuesFetched} issues · {result.historyEntriesFetched} history events ·{" "}
          {result.attachmentsFetched} linked resources.
        </p>
      )}
    </div>
  );
}
