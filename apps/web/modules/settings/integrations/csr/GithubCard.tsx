"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { ReauthBanner } from "@/components/shared/reauth-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GithubBackfillResult } from "@/lib/types/integrations";

/**
 * GitHub OAuth Apps have no single "workspace" the way a Jira site or Linear
 * workspace does — a `repo`-scoped token can see every repo the authorizing
 * user can access — so the org picks one repo explicitly, entered here the
 * same way Zendesk's subdomain is entered before its OAuth redirect.
 */
export function GithubConnectForm() {
  const [repo, setRepo] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    window.location.href = `/api/integrations/github/connect?repo=${encodeURIComponent(repo)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="github-repo">GitHub repository</Label>
        <Input
          id="github-repo"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          placeholder="acme/widgets"
          pattern="[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?/[A-Za-z0-9._-]+"
          required
          className="max-w-56"
        />
      </div>
      <Button type="submit" size="sm">
        Connect GitHub
      </Button>
    </form>
  );
}

interface GithubBackfillButtonProps {
  /** Needed to send the user back through /connect without retyping it. */
  repo: string;
  /** True when the stored credentials already carry `reauthRequired` (checked on the server before this renders). */
  initialReauthRequired?: boolean;
}

export function GithubBackfillButton({ repo, initialReauthRequired = false }: GithubBackfillButtonProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GithubBackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reauthRequired, setReauthRequired] = useState(initialReauthRequired);

  async function handleClick() {
    setRunning(true);
    setError(null);
    setResult(null);

    const { ok, body } = await Actions.Integrations.runGithubBackfill();
    setRunning(false);

    if (!ok) {
      if (body.reauthRequired) {
        setReauthRequired(true);
      } else {
        setError(body.error ?? "Backfill failed");
      }
      return;
    }

    setResult(body.backfill);
    router.refresh();
  }

  if (reauthRequired) {
    return (
      <ReauthBanner
        provider="GitHub"
        reconnectHref={`/api/integrations/github/connect?repo=${encodeURIComponent(repo)}`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={running}>
        {running && <Loader2 className="animate-spin" />}
        {running ? "Running backfill…" : "Run backfill"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <p className="text-sm text-muted-foreground">
          {result.pullRequestsFetched} pull requests · {result.timelineItemsFetched} timeline events.
        </p>
      )}
    </div>
  );
}
