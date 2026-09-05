import type { SlackChannel } from "./types";

const API_BASE = "https://slack.com/api";

interface SlackConversationsListResponse {
  ok: boolean;
  error?: string;
  channels: { id: string; name: string }[];
  response_metadata?: { next_cursor?: string };
}

/**
 * Lists public and private channels the bot can see, for the channel picker
 * in settings. Excludes archived channels — nothing should be posted where
 * no one will read it.
 */
export async function listChannels(accessToken: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${API_BASE}/conversations.list`);
    url.searchParams.set("types", "public_channel,private_channel");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Slack conversations.list failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as SlackConversationsListResponse;
    if (!body.ok) {
      throw new Error(`Slack conversations.list failed: ${body.error ?? "unknown error"}`);
    }

    channels.push(...body.channels.map((c) => ({ id: c.id, name: c.name })));
    cursor = body.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
}

export async function postMessage(accessToken: string, channelId: string, text: string): Promise<void> {
  const response = await fetch(`${API_BASE}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: channelId, text }),
  });

  if (!response.ok) {
    throw new Error(`Slack chat.postMessage failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as SlackPostMessageResponse;
  if (!body.ok) {
    throw new Error(`Slack chat.postMessage failed: ${body.error ?? "unknown error"}`);
  }
}
