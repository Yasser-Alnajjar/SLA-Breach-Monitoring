import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ReauthBanner({ subdomain }: { subdomain: string }) {
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertDescription>
        <p>Zendesk access has expired and needs to be reconnected before backfill can continue.</p>
        <a
          href={`/api/integrations/zendesk/connect?subdomain=${encodeURIComponent(subdomain)}`}
          className="mt-1 inline-block font-medium underline underline-offset-2"
        >
          Reconnect Zendesk
        </a>
      </AlertDescription>
    </Alert>
  );
}
