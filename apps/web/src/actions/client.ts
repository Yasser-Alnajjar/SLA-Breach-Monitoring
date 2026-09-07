import { signIn } from "next-auth/react";
import type { OnboardingStatus } from "@/lib/types/onboarding";
import type {
  IntegrationProvider,
  JiraBackfillResult,
  LinearBackfillResult,
  SlackChannel,
  ZendeskSyncResult,
} from "@/lib/types/integrations";
import type { SignUpInput } from "@/lib/sign-up";

interface ActionResult<T> {
  ok: boolean;
  status: number;
  body: T & { error?: string; reauthRequired?: boolean };
}

async function postJSON<T>(
  url: string,
  payload?: unknown,
): Promise<ActionResult<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers:
      payload !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

/**
 * Browser-only mutation layer. Every function here is a thin wrapper around
 * a `fetch()` call to an existing `app/api/**` route handler — kept in a
 * separate module from `@/actions` (the server data layer) so client
 * components never transitively import `@sla/db` or next-auth's server APIs.
 */
export const Actions = {
  Auth: {
    async signIn(email: string, password: string) {
      return signIn("credentials", { email, password, redirect: false });
    },
    async signUp(input: SignUpInput) {
      return postJSON<Record<string, never>>("/api/sign-up", input);
    },
  },

  Onboarding: {
    async getProgress(): Promise<OnboardingStatus | null> {
      const response = await fetch("/api/onboarding/progress");
      if (!response.ok) return null;
      return response.json();
    },
    async startZendeskBackfill() {
      return postJSON<Record<string, never>>(
        "/api/integrations/zendesk/backfill",
      );
    },
    async startJiraBackfill() {
      return postJSON<Record<string, never>>("/api/integrations/jira/backfill");
    },
  },

  Integrations: {
    async runZendeskBackfill() {
      return postJSON<ZendeskSyncResult>("/api/integrations/zendesk/backfill");
    },
    async runJiraBackfill() {
      return postJSON<{ backfill: JiraBackfillResult }>(
        "/api/integrations/jira/backfill",
      );
    },
    async runLinearBackfill() {
      return postJSON<{ backfill: LinearBackfillResult }>(
        "/api/integrations/linear/backfill",
      );
    },
    async loadSlackChannels() {
      const response = await fetch("/api/integrations/slack/channels");
      const body = await response.json();
      return {
        ok: response.ok,
        channels: body.channels as SlackChannel[] | undefined,
        error: body.error as string | undefined,
      };
    },
    async saveSlackChannel(channelId: string, channelName: string) {
      return postJSON<Record<string, never>>(
        "/api/integrations/slack/channel",
        { channelId, channelName },
      );
    },
    async setEngineeringTarget(targetMinutes: number) {
      return postJSON<Record<string, never>>(
        "/api/settings/engineering-target",
        { targetMinutes },
      );
    },
    async clearEngineeringTarget() {
      const response = await fetch("/api/settings/engineering-target", {
        method: "DELETE",
      });
      return { ok: response.ok };
    },
    async disconnect(provider: IntegrationProvider) {
      const response = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
      });
      if (response.ok) return { ok: true as const };
      const body = await response.json().catch(() => null);
      return {
        ok: false as const,
        error: (body?.error as string | undefined) ?? "Failed to disconnect",
      };
    },
  },
};
