"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { JiraBackfillResult } from "@/lib/types/integrations";

export function JiraConnectButton() {
  const handleConnect = () => {
    window.location.assign("/api/integrations/jira/connect");
  };

  return (
    <Button type="button" size="sm" onClick={handleConnect}>
      Connect Jira
    </Button>
  );
}

export function JiraBackfillButton({
  initialReauthRequired = false,
}: {
  initialReauthRequired?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<JiraBackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(initialReauthRequired);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const { ok, body } = await Actions.Integrations.runJiraBackfill();
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
    return (
      <ReauthBanner
        provider="Jira"
        reconnectHref="/api/integrations/jira/connect"
      />
    );
  }

  return (
    <div className="space-y-3">
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
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <p className="text-sm text-on-surface-variant wrap-break-word">
          {result.issuesFetched} issues · {result.changelogHistoriesFetched}{" "}
          changelog events · {result.remoteLinksFetched} remote links.
        </p>
      )}
    </div>
  );
}
