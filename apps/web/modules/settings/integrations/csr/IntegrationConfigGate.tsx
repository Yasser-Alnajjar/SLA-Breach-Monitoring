"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type {
  ConfigurableIntegrationProvider,
  IntegrationConfigStatus,
} from "@/lib/types/integrations";
import { IntegrationConfigForm } from "./IntegrationConfigForm";

interface IntegrationConfigGateProps {
  provider: ConfigurableIntegrationProvider;
  providerLabel: string;
  config: IntegrationConfigStatus;
  descriptionClass: string;
  /** Rendered instead of the config form once `config.configured` is true — the existing connect/connected UI for this provider. */
  children: ReactNode;
  /** Optional link to where an admin registers this provider's OAuth app and gets a client id/secret — shown in the unconfigured state, before "Configure" is clicked. */
  helpUrl?: string;
  helpLabel?: string;
}

/**
 * Gates a provider card's body on whether its OAuth app has been configured
 * yet. Unconfigured: shows a "Configure" button instead of `children`
 * (existing connect/connected UI never renders, since there's nothing to
 * connect with) — the client id/secret inputs themselves only appear once
 * that button is clicked, not up front. Configured: renders `children`
 * as-is, plus a small affordance to edit the saved configuration later —
 * the client secret is only ever write-only, so editing reuses the same
 * form with the client id prefilled.
 */
export function IntegrationConfigGate({
  provider,
  providerLabel,
  config,
  descriptionClass,
  children,
  helpUrl,
  helpLabel,
}: IntegrationConfigGateProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  if (!config?.configured) {
    return (
      <div className="flex flex-1 flex-col">
        <p className={descriptionClass}>
          Integration not configured. Configure this integration before
          connecting.
        </p>
        {helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 self-start text-xs text-primary underline-offset-2 hover:underline"
          >
            {helpLabel ?? "Get your client ID and secret"}
          </a>
        )}
        <div className="mt-auto pt-6">
          {configuring ? (
            <IntegrationConfigForm
              provider={provider}
              providerLabel={providerLabel}
              onSaved={() => router.refresh()}
              onCancel={() => setConfiguring(false)}
              open={configuring}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setConfiguring(true)}
            >
              Configure
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-1 flex-col">
        <IntegrationConfigForm
          provider={provider}
          providerLabel={providerLabel}
          initialClientId={config.clientId}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={() => setEditing(false)}
          open={editing}
        />
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="cursor-pointer   mt-3 self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Edit configuration
      </button>
    </>
  );
}
