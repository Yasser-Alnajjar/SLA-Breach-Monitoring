"use client";

import { MessageSquare, UserRound } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { formatActor, formatDateTime } from "@/lib/format";
import type {
  CaseDetailData,
  ConversationMessageDetail,
} from "@/lib/types/cases";

function SystemMessageNote({
  message,
}: {
  message: ConversationMessageDetail;
}) {
  return (
    <li className="flex justify-center py-1">
      <div className="max-w-[85%] rounded-lg border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2 font-[family-name:var(--font-mono,monospace)] text-[10px] font-semibold uppercase tracking-wider text-[var(--outline)]">
          <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[var(--on-surface-variant)]">
            Opened automatically
          </span>
          <span aria-hidden>·</span>
          <time className="tabular-nums">
            {formatDateTime(message.occurredAt)}
          </time>
        </div>
        <p className="mt-2 whitespace-pre-wrap wrap-break-word text-center text-sm leading-5 text-[var(--on-surface)]">
          {message.body}
        </p>
      </div>
    </li>
  );
}

function ConversationMessageBubble({
  message,
}: {
  message: ConversationMessageDetail;
}) {
  if (message.actor === "system")
    return <SystemMessageNote message={message} />;
  const isAgent = message.actor === "agent";
  const senderLabel = message.isRequester
    ? "Requester"
    : formatActor(message.actor);
  return (
    <li className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
      <article
        className={`max-w-[min(78%,54rem)] rounded-xl border p-4 shadow-sm ${isAgent ? "border-[var(--primary)]/20 bg-[var(--primary)]/5" : "border-[var(--surface-variant)] bg-[var(--surface-container)]"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex size-7 items-center justify-center rounded-full border ${isAgent ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--outline-variant)] bg-[var(--surface-container-high)] text-[var(--outline)]"}`}
          >
            <UserRound className="size-3.5" />
          </div>
          <span className="text-sm font-semibold text-[var(--on-surface)]">
            {message.authorName ?? formatActor(message.actor)}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-[family-name:var(--font-mono,monospace)] text-[10px] font-semibold uppercase tracking-wider ${isAgent ? "bg-[var(--primary-container)] text-[var(--on-primary)]" : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"}`}
          >
            {senderLabel}
          </span>
          <span className="text-outline-variant">·</span>
          <time className="font-mono text-[11px] text-outline tabular-nums">
            {formatDateTime(message.occurredAt)}
          </time>
        </div>
        <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-[var(--on-surface-variant)]">
          {message.body}
        </p>
      </article>
    </li>
  );
}

export function ConversationThread({ data }: { data: CaseDetailData }) {
  const lastMessage = data.conversation[data.conversation.length - 1];
  const { containerRef, onScroll } = useStickToBottom<HTMLOListElement>(
    lastMessage?.id ?? "",
  );
  return (
    <Reveal delay={0.1}>
      <section className="flex min-w-0 flex-col gap-4 rounded-xl bg-[var(--surface-container-low)] p-6 shadow-sm">
        <header className="flex flex-col justify-between gap-3 border-b border-[var(--surface-variant)]/50 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-[22px] text-[var(--primary)]" />
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                Customer ↔ Support
              </span>
              <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--on-surface)]">
                Conversation
              </h2>
            </div>
          </div>
          <span className="font-[family-name:var(--font-mono,monospace)] text-[11px] text-[var(--outline)]">
            {data.conversation.length} Message
            {data.conversation.length !== 1 ? "s" : ""} Recorded
          </span>
        </header>
        {data.conversation.length === 0 ? (
          <div className="rounded-lg bg-[var(--surface-container)] px-4 py-8 text-center text-sm text-[var(--on-surface-variant)]">
            No customer or agent messages yet.
          </div>
        ) : (
          <ol
            ref={containerRef}
            onScroll={onScroll}
            className="max-h-[42rem] space-y-4 overflow-y-auto pr-1"
          >
            {data.conversation.map((message) => (
              <ConversationMessageBubble key={message.id} message={message} />
            ))}
          </ol>
        )}
      </section>
    </Reveal>
  );
}
