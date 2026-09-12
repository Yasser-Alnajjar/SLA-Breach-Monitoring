"use client";

import { AlertCircle, CircleDot, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OnboardingStatus } from "@/lib/types/onboarding";

interface OnboardingProgressProps {
  status: OnboardingStatus;
  zendeskRunning: boolean;
  jiraRunning: boolean;
  error: string | null;
}

const stats = [
  {
    key: "ticketsFetched",
    label: "Tickets",
  },
  {
    key: "escalatedCases",
    label: "Escalations",
  },
  {
    key: "linkedIssues",
    label: "Linked issues",
  },
] as const;

export function OnboardingProgress({
  status,
  zendeskRunning,
  jiraRunning,
  error,
}: OnboardingProgressProps) {
  const message = zendeskRunning
    ? "Pulling your last 90 days from Zendesk…"
    : `Zendesk backfill complete${
        jiraRunning ? " — Jira is still catching up in the background." : "."
      }`;

  return (
    <>
      <div className="flex items-center gap-2.5 text-sm">
        {zendeskRunning ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <CircleDot className="size-4 shrink-0 text-success" />
        )}

        <p className="text-foreground">{message}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-interactive/30 px-3 py-2.5"
          >
            <p className="font-display text-xl font-medium tracking-tight">
              {status[key].toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
