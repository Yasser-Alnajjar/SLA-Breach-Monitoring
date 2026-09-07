"use client";

import { AlertCircle, ArrowRight, CircleDot, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Actions } from "@/actions/client";
import { Reveal } from "@/components/shared/reveal";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OnboardingStatus } from "@/lib/types/onboarding";
import { JiraConnectButton } from "@modules/settings/integrations/csr/JiraCard";
import { ZendeskConnectForm } from "@modules/settings/integrations/csr/ZendeskCard";

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
      Actions.Onboarding.startZendeskBackfill().then(({ ok, body }) => {
        if (!ok) setError(body.error ?? "Zendesk backfill failed to start");
      });
    }
    if (jiraRunning && !triggered.current.jira) {
      triggered.current.jira = true;
      Actions.Onboarding.startJiraBackfill().then(({ ok, body }) => {
        if (!ok) setError(body.error ?? "Jira backfill failed to start");
      });
    }
  }, [zendeskRunning, jiraRunning]);

  useEffect(() => {
    if (!zendeskRunning && !jiraRunning) return;
    const interval = setInterval(async () => {
      const progress = await Actions.Onboarding.getProgress();
      if (progress) setStatus(progress);
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
      <Reveal>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              Connect Zendesk to pull your last 90 days of tickets, SLA policies, and organizations —
              read-only, one click.
            </p>
            <div className="mt-4">
              <ZendeskConnectForm />
            </div>
          </CardContent>
        </Card>
      </Reveal>
    );
  }

  if (status.zendesk.reauthRequired) {
    return (
      <Reveal>
        <ReauthBanner
          provider="Zendesk"
          reconnectHref={`/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(zendeskSubdomain ?? "")}`}
        />
      </Reveal>
    );
  }

  return (
    <Reveal>
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center gap-2.5 text-sm">
            {zendeskRunning ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CircleDot className="size-4 shrink-0 text-success" />
            )}
            <p className="text-foreground">
              {zendeskRunning
                ? "Pulling your last 90 days from Zendesk…"
                : `Zendesk backfill complete${jiraRunning ? " — Jira is still catching up in the background." : "."}`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Tickets", value: status.ticketsFetched },
              { label: "Escalations", value: status.escalatedCases },
              { label: "Linked issues", value: status.linkedIssues },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-interactive/30 px-3 py-2.5">
                <p className="font-display text-xl font-medium tracking-tight">{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {!status.jira.connected && (
            <div className="rounded-lg border border-dashed border-border p-3.5">
              <p className="text-sm text-muted-foreground">
                Connecting Jira adds engineering-leg timing — optional, and can be done later without
                losing progress.
              </p>
              <div className="mt-3">
                <JiraConnectButton />
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status.zendesk.backfillComplete && (
            <Button asChild>
              <a href="/onboarding/findings">
                Findings are ready
                <ArrowRight />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}
