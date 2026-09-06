"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BackfillResult } from "@sla/jira";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function JiraConnectButton() {
  return (
    <Button type="button" size="sm" onClick={() => (window.location.href = "/api/integrations/jira/connect")}>
      Connect Jira
    </Button>
  );
}

export function JiraBackfillButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/integrations/jira/backfill", { method: "POST" });
    const body = await response.json();
    setRunning(false);

    if (!response.ok) {
      setError(body.error ?? "Backfill failed");
      return;
    }

    setResult(body.backfill as BackfillResult);
    router.refresh();
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
          {result.issuesFetched} issues · {result.changelogHistoriesFetched} changelog events ·{" "}
          {result.remoteLinksFetched} remote links.
        </p>
      )}
    </div>
  );
}
