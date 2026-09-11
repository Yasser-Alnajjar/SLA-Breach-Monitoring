/** Formats a signed minute count as "1d 2h 3m", dropping leading zero units. */
export function formatMinutes(totalMinutes: number): string {
  const abs = Math.round(Math.abs(totalMinutes));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const minutes = abs % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return (totalMinutes < 0 ? "-" : "") + parts.join(" ");
}

const LEG_LABELS: Record<string, string> = {
  support: "Support",
  engineering: "Engineering",
  waiting_customer: "Waiting on customer",
  unknown: "Unknown",
};

export function formatLeg(leg: string): string {
  return LEG_LABELS[leg] ?? leg;
}

const COMMITMENT_KIND_LABELS: Record<string, string> = {
  first_response: "First response",
  resolution: "Resolution",
};

export function formatCommitmentKind(kind: string): string {
  return COMMITMENT_KIND_LABELS[kind] ?? kind;
}

/** Human-readable summary of an SLAPolicyVersion's match conditions, e.g. "priority in [urgent] · customer-specific". */
export function formatPolicyMatch(match: {
  priority?: string[];
  tier?: string[];
  customerIds?: string[];
}): string {
  return (
    [
      match.priority && `priority in [${match.priority.join(", ")}]`,
      match.tier && `tier in [${match.tier.join(", ")}]`,
      match.customerIds && "customer-specific",
    ]
      .filter(Boolean)
      .join(" · ") || "Any case (default)"
  );
}

const COMMITMENT_STATUS_LABELS: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  met: "Met",
  breached: "Breached",
  cancelled: "Cancelled",
};

export function formatCommitmentStatus(status: string): string {
  return COMMITMENT_STATUS_LABELS[status] ?? status;
}

const NORMALIZED_STATE_LABELS: Record<string, string> = {
  new: "New",
  open: "Open",
  pending_customer: "Pending customer",
  pending_internal: "Pending internal",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export function formatNormalizedState(state: string): string {
  return NORMALIZED_STATE_LABELS[state] ?? state;
}

/**
 * These are the engine's own semantic states, not any provider's literal
 * status text — a Zendesk "Pending" and a Jira "Waiting on Customer" both
 * normalize to `pending_customer` (see packages/core/src/types.ts). Shown in
 * the case timeline's glossary popover so "Open → Pending customer" reads as
 * more than an opaque state code.
 */
export const NORMALIZED_STATE_DESCRIPTIONS: Record<string, string> = {
  new: "Case just created — no status update from the source system yet.",
  open: "Actively open and owned by support or engineering.",
  in_progress: "Being actively worked, per the linked engineering tracker.",
  pending_customer:
    "Waiting on the customer to respond. Whichever provider drives this, it puts the case on the \"waiting on customer\" leg.",
  pending_internal: "Waiting on something internal — not the customer.",
  escalated: "Flagged as escalated or high urgency.",
  resolved: "Marked resolved by the team, ahead of a final close.",
  closed: "Fully closed.",
};

const ACTOR_LABELS: Record<string, string> = {
  customer: "Customer",
  agent: "Agent",
  system: "System",
};

export function formatActor(actor: string): string {
  return ACTOR_LABELS[actor] ?? actor;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/** e.g. "Mon 09:00–17:00" for one BusinessCalendarVersion.weekly entry. */
export function formatWeeklyWindow(window: {
  day: number;
  openMinute: number;
  closeMinute: number;
}): string {
  return `${DAY_LABELS[window.day] ?? window.day} ${formatMinuteOfDay(window.openMinute)}–${formatMinuteOfDay(window.closeMinute)}`;
}

// "remote_link" covers both a Jira remote link and a Linear attachment — the
// two providers' equivalent of "a URL pointing back at the Zendesk ticket" —
// so the label stays provider-neutral; which system it is renders separately
// alongside it wherever a CaseLink is displayed.
const CASE_LINK_METHOD_LABELS: Record<string, string> = {
  official_link: "Official Zendesk↔Jira link",
  remote_link: "Remote link",
  pattern: "Pattern match",
  manual: "Manually linked",
};

export function formatCaseLinkMethod(method: string): string {
  return CASE_LINK_METHOD_LABELS[method] ?? method;
}
