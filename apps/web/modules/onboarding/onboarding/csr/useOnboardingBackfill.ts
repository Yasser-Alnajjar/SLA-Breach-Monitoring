"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Actions } from "@/actions/client";
import type { OnboardingStatus } from "@/lib/types/onboarding";

interface UseOnboardingBackfillOptions {
  status: OnboardingStatus;
}

export function useOnboardingBackfill({
  status,
}: UseOnboardingBackfillOptions) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef({
    zendesk: false,
    jira: false,
  });

  const zendeskRunning =
    currentStatus.zendesk.connected &&
    !currentStatus.zendesk.backfillComplete &&
    !currentStatus.zendesk.reauthRequired;

  const jiraRunning =
    currentStatus.jira.connected &&
    !currentStatus.jira.backfillComplete &&
    !currentStatus.jira.reauthRequired;

  const refresh = useCallback(async () => {
    const progress = await Actions.Onboarding.getProgress();

    if (progress) {
      setCurrentStatus(progress);
    }

    return progress;
  }, []);

  useEffect(() => {
    if (zendeskRunning && !startedRef.current.zendesk) {
      startedRef.current.zendesk = true;

      void Actions.Onboarding.startZendeskBackfill().then(({ ok, body }) => {
        if (!ok) {
          setError(body.error ?? "Zendesk backfill failed to start");
        }
      });
    }

    if (jiraRunning && !startedRef.current.jira) {
      startedRef.current.jira = true;

      void Actions.Onboarding.startJiraBackfill().then(({ ok, body }) => {
        if (!ok) {
          setError(body.error ?? "Jira backfill failed to start");
        }
      });
    }
  }, [zendeskRunning, jiraRunning]);

  useEffect(() => {
    if (!zendeskRunning && !jiraRunning) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const progress = await Actions.Onboarding.getProgress();

      if (!cancelled && progress) {
        setCurrentStatus(progress);
      }
    };

    void poll();

    const interval = window.setInterval(poll, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [zendeskRunning, jiraRunning]);

  return {
    status: currentStatus,
    error,
    zendeskRunning,
    jiraRunning,
    refresh,
  };
}
