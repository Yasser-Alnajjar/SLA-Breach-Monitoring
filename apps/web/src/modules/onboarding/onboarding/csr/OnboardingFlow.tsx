"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { Reveal } from "@/components/shared/reveal";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OnboardingStatus } from "@/lib/types/onboarding";

import { IntegrationConfigGate } from "@modules/settings/integrations/csr/IntegrationConfigGate";
import { JiraConnectButton } from "@modules/settings/integrations/csr/JiraCard";
import { ZendeskConnectForm } from "@modules/settings/integrations/csr/ZendeskCard";

import { OnboardingProgress } from "./OnboardingProgress";
import { useOnboardingBackfill } from "./useOnboardingBackfill";

const DESCRIPTION_CLASS = "text-sm text-muted-foreground";

interface OnboardingFlowProps {
  initialStatus: OnboardingStatus;
  zendeskSubdomain: string | null;
}

export function OnboardingFlow({
  initialStatus,
  zendeskSubdomain,
}: OnboardingFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { status, error, zendeskRunning, jiraRunning, refresh } =
    useOnboardingBackfill({
      status: initialStatus,
    });

  const consumedConnectedParam = useRef(false);

  useEffect(() => {
    const connected = searchParams.get("connected");

    if (!connected || consumedConnectedParam.current) {
      return;
    }

    consumedConnectedParam.current = true;

    void refresh();
    router.replace("/onboarding");
  }, [searchParams, refresh, router]);

  const onboardingComplete =
    status.zendesk.connected &&
    status.zendesk.backfillComplete &&
    status.jira.connected;

  useEffect(() => {
    if (!onboardingComplete) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push("/onboarding/findings");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [router, onboardingComplete]);

  if (!status.zendesk.connected) {
    return (
      <Reveal>
        <Card>
          <CardContent className="pt-5">
            <IntegrationConfigGate
              provider="zendesk"
              providerLabel="Zendesk"
              config={status.zendeskConfig}
              descriptionClass={DESCRIPTION_CLASS}
              onConfigured={refresh}
            >
              <p className={DESCRIPTION_CLASS}>
                Connect Zendesk to pull your last 90 days of tickets, SLA
                policies, and organizations — read-only, one click.
              </p>

              <div className="mt-4">
                <ZendeskConnectForm />
              </div>
            </IntegrationConfigGate>
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
          reconnectHref={`/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(
            zendeskSubdomain ?? "",
          )}`}
        />
      </Reveal>
    );
  }

  return (
    <Reveal>
      <Card>
        <CardContent className="space-y-5 pt-5">
          <OnboardingProgress
            status={status}
            zendeskRunning={zendeskRunning}
            jiraRunning={jiraRunning}
            error={error}
          />

          {!status.jira.connected && (
            <div className="rounded-lg border border-dashed border-border p-3.5">
              <IntegrationConfigGate
                provider="jira"
                providerLabel="Jira"
                config={status.jiraConfig}
                descriptionClass={DESCRIPTION_CLASS}
                onConfigured={refresh}
              >
                <p className={DESCRIPTION_CLASS}>
                  Connect Jira to add engineering-leg timing and correlate
                  support cases with engineering work.
                </p>

                <div className="mt-3">
                  <JiraConnectButton />
                </div>
              </IntegrationConfigGate>
            </div>
          )}

          {onboardingComplete && (
            <Button asChild>
              <Link href="/onboarding/findings">
                Findings are ready
                <ArrowRight />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}
