"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SlackChannel } from "@sla/slack";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SlackConnectButton() {
  return (
    <Button type="button" size="sm" onClick={() => (window.location.href = "/api/integrations/slack/connect")}>
      Connect Slack
    </Button>
  );
}

/** Shown once Slack is installed but no channel has been chosen yet (Phase 11 step 8). */
export function SlackChannelPicker() {
  const router = useRouter();
  const [channels, setChannels] = useState<SlackChannel[] | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadChannels() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/integrations/slack/channels");
    const body = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? "Failed to load channels");
      return;
    }

    setChannels(body.channels as SlackChannel[]);
  }

  async function handleSave() {
    const channel = channels?.find((c) => c.id === selected);
    if (!channel) return;

    setSaving(true);
    setError(null);

    const response = await fetch("/api/integrations/slack/channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, channelName: channel.name }),
    });
    const body = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(body.error ?? "Failed to save channel");
      return;
    }

    router.refresh();
  }

  if (channels === null) {
    return (
      <div className="space-y-3">
        <Button type="button" size="sm" variant="outline" onClick={loadChannels} disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Loading channels…" : "Choose a channel"}
        </Button>
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
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select a channel" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((channel) => (
            <SelectItem key={channel.id} value={channel.id}>
              #{channel.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="sm" onClick={handleSave} disabled={!selected || saving}>
        {saving && <Loader2 className="animate-spin" />}
        {saving ? "Saving…" : "Save channel"}
      </Button>
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function SlackChannelChangeButton() {
  const [changing, setChanging] = useState(false);
  if (changing) return <SlackChannelPicker />;
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => setChanging(true)}>
      Change channel
    </Button>
  );
}
