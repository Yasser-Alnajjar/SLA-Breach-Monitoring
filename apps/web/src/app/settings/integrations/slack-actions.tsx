"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SlackChannel } from "@sla/slack";

export function SlackConnectButton() {
  return (
    <button type="button" onClick={() => (window.location.href = "/api/integrations/slack/connect")}>
      Connect Slack
    </button>
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
      <div>
        <button type="button" onClick={loadChannels} disabled={loading}>
          {loading ? "Loading channels…" : "Choose a channel"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <select value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="" disabled>
          Select a channel
        </option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleSave} disabled={!selected || saving}>
        {saving ? "Saving…" : "Save channel"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function SlackChannelChangeButton() {
  const [changing, setChanging] = useState(false);
  if (changing) return <SlackChannelPicker />;
  return (
    <button type="button" onClick={() => setChanging(true)}>
      Change channel
    </button>
  );
}
