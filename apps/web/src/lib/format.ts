import type { CommitmentKind } from "@sla/core";

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

/**
 * Formats a signed second count for SLA timing: "1m 26s" under an hour, where
 * seconds matter, and "1d 2h 3m" (like `formatMinutes`) beyond it.
 */
export function formatSeconds(totalSeconds: number): string {
  const abs = Math.abs(Math.trunc(totalSeconds));
  if (abs >= 3600) return (totalSeconds < 0 ? "-" : "") + formatMinutes(Math.floor(abs / 60));

  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes}m`);
  if (minutes === 0 || seconds > 0) parts.push(`${seconds}s`);

  return (totalSeconds < 0 ? "-" : "") + parts.join(" ");
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

// Record<CommitmentKind, string>, not Record<string, string>: a new
// CommitmentKind fails to compile here until it's given a label, so this
// can't silently fall behind the engine's own kinds again.
const COMMITMENT_KIND_LABELS: Record<CommitmentKind, string> = {
  first_response: "First response",
  resolution: "Resolution",
  next_reply: "Next reply",
};

export function formatCommitmentKind(kind: CommitmentKind): string {
  return COMMITMENT_KIND_LABELS[kind];
}

/**
 * A Next Reply commitment's 1-based position among a case's Next Reply
 * cycles, ordered by `startedAt` — e.g. "Cycle 1", "Cycle 2" for display
 * only. Purely presentational: derived fresh from already-fetched
 * commitments, never stored, and unrelated to `cycleKey` (the engine's own
 * stable cycle identity). Commitments of other kinds are absent from the map.
 */
export function nextReplyCycleNumbers(
  commitments: { id: string; kind: CommitmentKind; startedAt: string }[],
): Map<string, number> {
  return new Map(
    commitments
      .filter((c) => c.kind === "next_reply")
      .slice()
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((c, index) => [c.id, index + 1]),
  );
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

/** Formats a millisecond interval as e.g. "5 seconds" / "1 hour" — picks the largest unit that divides it evenly. */
export function formatIntervalMs(ms: number): string {
  const units: { ms: number; singular: string }[] = [
    { ms: 24 * 60 * 60_000, singular: "day" },
    { ms: 60 * 60_000, singular: "hour" },
    { ms: 60_000, singular: "minute" },
    { ms: 1_000, singular: "second" },
  ];

  for (const unit of units) {
    if (ms % unit.ms === 0) {
      const count = ms / unit.ms;
      return `${count} ${unit.singular}${count === 1 ? "" : "s"}`;
    }
  }
  return `${Math.round(ms / 1000)} seconds`;
}

/** e.g. "Sep 14, 2026, 07:05:32" / "Never" for a null timestamp — a static, second-precision rendering of a worker-reported time. Deliberately not relative: it must not drift or need a client-side tick to stay correct. */
export function formatExactTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * The target and deadline line under a commitment's remaining time. Built
 * only from the evaluator's pause-aware fields: a paused clock has no due
 * time to show, so it says when the pause began instead of a fixed deadline.
 */
export function formatCommitmentDeadline(commitment: {
  status: string;
  targetMinutes: number;
  clockState: "running" | "paused" | "stopped";
  pausedSince: string | null;
  effectiveDueAt: string | null;
}): string {
  const target = `Target ${formatMinutes(commitment.targetMinutes)}`;
  if (commitment.status === "breached" && commitment.effectiveDueAt) {
    return `${target} · Breached ${formatDateTime(commitment.effectiveDueAt)}`;
  }
  if (commitment.clockState === "paused" && commitment.pausedSince) {
    return `${target} · Paused since ${formatDateTime(commitment.pausedSince)}, no due time until the clock resumes`;
  }
  if (commitment.clockState === "running" && commitment.effectiveDueAt) {
    return `${target} · Due ${formatDateTime(commitment.effectiveDueAt)}`;
  }
  return target;
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
