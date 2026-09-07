"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { IntegrationProvider } from "@/lib/types/integrations";

interface DisconnectButtonProps {
  provider: IntegrationProvider;
  providerLabel: string;
}

/**
 * Two-step disconnect (click to arm, click again to confirm) rather than a
 * native `confirm()` dialog, matching this settings page's other inline
 * confirm-by-second-click patterns. Always a soft disconnect server-side —
 * credentials cleared, row kept (roadmap step 17).
 */
export function DisconnectButton({ provider, providerLabel }: DisconnectButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDisconnecting(true);
    setError(null);

    const result = await Actions.Integrations.disconnect(provider);
    setDisconnecting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Stop syncing {providerLabel} and remove access? Existing cases and history stay.
          </p>
          <Button type="button" size="sm" variant="destructive" onClick={handleConfirm} disabled={disconnecting}>
            {disconnecting && <Loader2 className="animate-spin" />}
            Confirm disconnect
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={disconnecting}>
            Cancel
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Disconnect
    </Button>
  );
}
