"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { OnboardingStatus } from "@/lib/onboarding-data";
import { JiraConnectButton } from "../settings/integrations/jira-actions";
import { ZendeskConnectForm } from "../settings/integrations/zendesk-actions";

interface OnboardingFlowProps {
  initialStatus: OnboardingStatus;
  zendeskSubdomain: string | null;
}

/**
 * Drives the "no configuration before first value" flow (Phase 11): once
 * Zendesk is connected, backfill starts on its own — no "run backfill"
 * button — and this polls `/api/onboarding/progress` for the live counts
 * while it runs, then moves on to the findings screen the moment Zendesk's
 * backfill completes. Jira is optional and never blocks the handoff: a
 * pending Jira grant is exactly the friction Phase 11 says must not stall
 * the trial (see plans/03-Product-and-MVP.md's onboarding-friction notes).
 */
export function OnboardingFlow({ initialStatus, zendeskSubdomain }: OnboardingFlowProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef({ zendesk: false, jira: false });

  const zendeskRunning = status.zendesk.connected && !status.zendesk.backfillComplete && !status.zendesk.reauthRequired;
  const jiraRunning = status.jira.connected && !status.jira.backfillComplete && !status.jira.reauthRequired;

  useEffect(() => {
    if (zendeskRunning && !triggered.current.zendesk) {
      triggered.current.zendesk = true;
      fetch("/api/integrations/zendesk/backfill", { method: "POST" })
        .then((res) => res.json())
        .then((body) => {
          if (body.error) setError(body.error);
        })
        .catch(() => setError("Zendesk backfill failed to start"));
    }
    if (jiraRunning && !triggered.current.jira) {
      triggered.current.jira = true;
      fetch("/api/integrations/jira/backfill", { method: "POST" })
        .then((res) => res.json())
        .then((body) => {
          if (body.error) setError(body.error);
        })
        .catch(() => setError("Jira backfill failed to start"));
    }
  }, [zendeskRunning, jiraRunning]);

  useEffect(() => {
    if (!zendeskRunning && !jiraRunning) return;
    const interval = setInterval(async () => {
      const res = await fetch("/api/onboarding/progress");
      if (res.ok) setStatus(await res.json());
    }, 2500);
    return () => clearInterval(interval);
  }, [zendeskRunning, jiraRunning]);

  useEffect(() => {
    if (status.zendesk.connected && status.zendesk.backfillComplete) {
      const timeout = setTimeout(() => router.push("/onboarding/findings"), 1200);
      return () => clearTimeout(timeout);
    }
  }, [status.zendesk.connected, status.zendesk.backfillComplete, router]);

  if (!status.zendesk.connected) {
    return (
      <div className="onboarding-step">
        <p>Connect Zendesk to pull your last 90 days of tickets, SLA policies, and organizations — read-only, one click.</p>
        <ZendeskConnectForm />
      </div>
    );
  }

  if (status.zendesk.reauthRequired) {
    return (
      <div role="alert" className="zendesk-reauth-banner">
        <p>Zendesk access has expired and needs to be reconnected before backfill can continue.</p>
        <a href={`/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(zendeskSubdomain ?? "")}`}>
          Reconnect Zendesk
        </a>
      </div>
    );
  }

  return (
    <div className="onboarding-step">
      {zendeskRunning ? (
        <p>Pulling your last 90 days from Zendesk…</p>
      ) : (
        <p>Zendesk backfill complete{jiraRunning ? " — Jira is still catching up in the background." : "."}</p>
      )}

      <p className="onboarding-counts">
        <strong>{status.ticketsFetched.toLocaleString()}</strong> tickets ·{" "}
        <strong>{status.escalatedCases.toLocaleString()}</strong> escalations ·{" "}
        <strong>{status.linkedIssues.toLocaleString()}</strong> linked issues
      </p>

      {!status.jira.connected && (
        <div className="onboarding-jira-prompt">
          <p>Connecting Jira adds engineering-leg timing — optional, and can be done later without losing progress.</p>
          <JiraConnectButton />
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      {status.zendesk.backfillComplete && (
        <p>
          <a href="/onboarding/findings">Findings are ready →</a>
        </p>
      )}
    </div>
  );
}
