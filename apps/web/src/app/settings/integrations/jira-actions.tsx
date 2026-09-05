"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BackfillResult } from "@sla/jira";

export function JiraConnectButton() {
  return (
    <button type="button" onClick={() => (window.location.href = "/api/integrations/jira/connect")}>
      Connect Jira
    </button>
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
    <div>
      <button type="button" onClick={handleClick} disabled={running}>
        {running ? "Running backfill…" : "Run backfill"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <p>
          {result.issuesFetched} issues · {result.changelogHistoriesFetched} changelog events ·{" "}
          {result.remoteLinksFetched} remote links.
        </p>
      )}
    </div>
  );
}
