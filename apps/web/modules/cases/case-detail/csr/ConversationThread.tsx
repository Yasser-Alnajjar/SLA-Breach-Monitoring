"use client";

import { MessageSquare } from "lucide-react";

import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatActor, formatDateTime } from "@/lib/format";
import type { CaseDetailData, ConversationMessageDetail } from "@/lib/types/cases";

/**
 * One message bubble. Side (left/right) and color are driven only by
 * `message.actor` — the already-resolved Customer/Agent distinction from
 * `NormalizedEvent.actor` — never by the author's name, so a customer named
 * e.g. "Alex Support" still renders as a customer message.
 */
function ConversationMessageBubble({
  message,
}: {
  message: ConversationMessageDetail;
}) {
  const isAgent = message.actor === "agent";
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
            {formatActor(message.actor)}
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
            <ol className="max-h-128 space-y-3 overflow-y-auto">
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
