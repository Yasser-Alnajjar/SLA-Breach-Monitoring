"use client";

import { MessageSquare } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { formatActor, formatDateTime } from "@/lib/format";
import type { CaseDetailData, ConversationMessageDetail } from "@/lib/types/cases";

/**
 * A ticket opened by a trigger/automation/rule (3.7) — no Customer/Agent
 * side to attach its opening message to, so it renders as a centered,
 * neutral system note instead of a left/right bubble.
 */
function SystemMessageNote({ message }: { message: ConversationMessageDetail }) {
  return (
    <li className="flex justify-center">
      <div className="max-w-[85%] rounded-lg border border-dashed border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            Opened automatically
          </Badge>
          <span aria-hidden>·</span>
          <time className="tabular-nums">
            {formatDateTime(message.occurredAt)}
          </time>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-center text-sm leading-5 text-foreground">
          {message.body}
        </p>
      </div>
    </li>
  );
}

/**
 * One message bubble. Side (left/right) and color are driven only by
 * `message.actor` — the already-resolved Customer/Agent distinction from
 * `NormalizedEvent.actor` — never by the author's name, so a customer named
 * e.g. "Alex Support" still renders as a customer message. The sender badge
 * (3.7) reads "Requester" instead of "Customer" only when the author is
 * confirmed to be the case's own requester (`message.isRequester`) — an
 * unconfirmed customer contact still reads as plain "Customer".
 */
function ConversationMessageBubble({
  message,
}: {
  message: ConversationMessageDetail;
}) {
  if (message.actor === "system") {
    return <SystemMessageNote message={message} />;
  }

  const isAgent = message.actor === "agent";
  const senderLabel = message.isRequester ? "Requester" : formatActor(message.actor);
  return (
    <li className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg border p-3 ${
          isAgent
            ? "border-primary/20 bg-primary/5"
            : "border-border bg-muted/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.authorName ?? formatActor(message.actor)}
          </span>

          <Badge
            variant={isAgent ? "primary" : "outline"}
            className="h-5 px-1.5 text-[10px]"
          >
            {senderLabel}
          </Badge>

          <span aria-hidden>·</span>

          <time className="tabular-nums">
            {formatDateTime(message.occurredAt)}
          </time>
        </div>

        <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm leading-5 text-foreground">
          {message.body}
        </p>
      </div>
    </li>
  );
}

export function ConversationThread({ data }: { data: CaseDetailData }) {
  const lastMessage = data.conversation[data.conversation.length - 1];
  // Keyed off the newest message's id (not just the count) so a poll that
  // replaces the same number of messages with different content — or the
  // very first message ever arriving — still re-pins to the bottom.
  const { containerRef, onScroll } = useStickToBottom<HTMLOListElement>(
    lastMessage?.id ?? "",
  );

  return (
    <Reveal delay={0.1}>
      <Card className="min-w-0">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <MessageSquare className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>

        <CardContent>
          {data.conversation.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customer or agent messages yet.
            </p>
          ) : (
            <ol
              ref={containerRef}
              onScroll={onScroll}
              className="max-h-128 space-y-3 overflow-y-auto"
            >
              {data.conversation.map((message) => (
                <ConversationMessageBubble key={message.id} message={message} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </Reveal>
  );
}
