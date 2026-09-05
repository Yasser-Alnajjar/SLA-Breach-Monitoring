"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { BackfillResult, NormalizationResult } from "@sla/zendesk";

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
    <form onSubmit={handleSubmit} className="zendesk-connect-form">
      <label>
        Zendesk subdomain
        <input
          value={subdomain}
          onChange={(event) => setSubdomain(event.target.value)}
          placeholder="acme"
          pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*"
          required
        />
        <span>.zendesk.com</span>
      </label>
      <button type="submit">Connect Zendesk</button>
    </form>
  );
}

export function ZendeskBackfillButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/integrations/zendesk/backfill", { method: "POST" });
    const body = await response.json();
    setRunning(false);

    if (!response.ok) {
      setError(body.error ?? "Backfill failed");
      return;
    }

    setResult(body as SyncResult);
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={running}>
        {running ? "Running backfill…" : "Run backfill"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
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
        </>
      )}
    </div>
  );
}
