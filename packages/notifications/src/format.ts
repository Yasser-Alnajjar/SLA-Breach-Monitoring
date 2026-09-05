import { BREACH_NOTIFICATION_THRESHOLD } from "@sla/core";
import type { NotificationCandidate } from "@sla/commitments";

export interface NotificationContext {
  externalId: string;
  customerName: string | null;
}

const KIND_LABEL: Record<NotificationCandidate["kind"], string> = {
  first_response: "First response",
  resolution: "Resolution",
};

/** e.g. `2h 15m`, `45m`, `3h`. Always non-negative — callers decide sign. */
function formatMinutes(minutes: number): string {
  const abs = Math.max(0, Math.round(minutes));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Plain-text Slack message for one notification candidate. Pure and
 * side-effect free so message content can be unit tested without a Slack
 * workspace or a database.
 */
export function formatSlackMessage(candidate: NotificationCandidate, context: NotificationContext): string {
  const kindLabel = KIND_LABEL[candidate.kind];
  const who = context.customerName ? ` for ${context.customerName}` : "";
  const ticket = `#${context.externalId}`;

  if (candidate.threshold === BREACH_NOTIFICATION_THRESHOLD) {
    const over = formatMinutes(candidate.breachedByMinutes ?? 0);
    return `:rotating_light: *${kindLabel} SLA breached* — ${ticket}${who}, over target by ${over}.`;
  }

  const remaining = formatMinutes(candidate.remainingMinutes);
  return `:warning: *${kindLabel} SLA at risk* — ${ticket}${who}, ${candidate.threshold}% of target used, ${remaining} remaining.`;
}
