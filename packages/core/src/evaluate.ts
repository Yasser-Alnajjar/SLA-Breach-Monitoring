import { computeDeadline, workingMinutesBetween } from "./calendar";
import { foldClockIntervals, sumRunningWorkingMinutes } from "./elapsed";
import type {
  BusinessCalendarVersion,
  ClockState,
  Commitment,
  CommitmentKind,
  CommitmentStatus,
  Evaluation,
  EvaluationEventRef,
  NormalizedEvent,
  SLAPolicyVersion,
} from "./types";
import { stableHash } from "./util";

/**
 * Sentinel `warnThresholdCrossed` value for a breach, stored as the
 * `threshold` on a `Notification` row (Phase 13.7). Safe as a fixed 100:
 * `warnAtPercent` values are always below 100 by construction (they gate
 * "at_risk", which requires `remainingMinutes > 0`), so it never collides
 * with a real warn threshold.
 */
export const BREACH_NOTIFICATION_THRESHOLD = 100;

/**
 * Fixed warn threshold for the engineering-leg OLA target (roadmap step 16).
 * Not configurable — "one optional target duration per engineering leg, not
 * a policy builder" rules out a per-org `warnAtPercent` array here.
 */
export const ENGINEERING_LEG_WARN_AT_PERCENT = 80;

export interface EngineeringLegEvaluation {
  targetMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  status: "on_track" | "at_risk" | "met" | "breached";
  breachedByMinutes?: number;
}

/**
 * Evaluates an optional engineering-leg OLA target against the cumulative
 * minutes a case has spent in the engineering leg (`sumLegMinutes` in
 * `legs.ts`). Mirrors `evaluateCommitment`'s status ladder
 * (`on_track → at_risk → met | breached`) but has no policy/calendar of its
 * own — `elapsedMinutes` is plain wall-clock time, not working minutes,
 * matching how the dashboard's existing "aging in engineering" metric is
 * already computed (`minutesBetween`, not calendar-aware).
 *
 * `legIsOpen` is whether the case is *currently* in the engineering leg: a
 * breach is permanent once minutes exceed target, but "met" only applies
 * once the leg has actually closed under target — a case still inside the
 * leg is `at_risk`/`on_track`, never `met`.
 */
export function evaluateEngineeringLegTarget(
  elapsedMinutes: number,
  targetMinutes: number,
  legIsOpen: boolean,
): EngineeringLegEvaluation {
  const remainingMinutes = targetMinutes - elapsedMinutes;

  let status: EngineeringLegEvaluation["status"];
  if (remainingMinutes < 0) {
    status = "breached";
  } else if (!legIsOpen) {
    status = "met";
  } else {
    const percentConsumed = (elapsedMinutes / targetMinutes) * 100;
    status = percentConsumed >= ENGINEERING_LEG_WARN_AT_PERCENT ? "at_risk" : "on_track";
  }

  return {
    targetMinutes,
    elapsedMinutes,
    remainingMinutes,
    status,
    breachedByMinutes: remainingMinutes < 0 ? -remainingMinutes : undefined,
  };
}

/**
 * Ticket-source systems — the ones that create Cases and so own their
 * lifecycle (roadmap step 22 added Intercom beside Zendesk). Matches the
 * support-side systems `deriveLegSpans` in legs.ts already reads.
 */
const TICKET_SOURCE_SYSTEMS = new Set<NormalizedEvent["system"]>(["zendesk", "intercom"]);

/** Event types that carry the ticket source's own view of the case's lifecycle state. */
const TICKET_LIFECYCLE_EVENT_TYPES = new Set<NormalizedEvent["type"]>([
  "case_created",
  "state_changed",
  "case_closed",
]);

/**
 * The event that closed the case, if it is closed as of `asOf`: the first
 * ticket-source (Zendesk or Intercom) `case_closed` of the *current*
 * closure, or null if none has happened yet or the case is currently open.
 *
 * Only the ticket source ever anchors a case's lifecycle — a linked Jira issue is
 * never the anchor, and its normalizer never emits `case_created`/
 * `case_closed` (packages/jira/src/normalize.ts) — so a Jira transition
 * (e.g. reaching its own "done" category) can never close or reopen a case
 * here, regardless of when it lands relative to Zendesk's own events.
 *
 * Open vs closed is decided by the *most recent* lifecycle event, not
 * merely "did a case_closed ever happen", which is what lets a Zendesk
 * ticket that was solved and later reopened correctly resume SLA tracking
 * instead of staying permanently resolved.
 *
 * But the event returned is the earliest `case_closed` in the unbroken run
 * of closes ending at that most recent event: Zendesk's solved -> closed
 * (typically an automation days later) is a second `case_closed` that
 * doesn't reopen anything, so the case closed at the solve, not the
 * auto-close.
 */
export function findCaseCloseEvent(
  events: NormalizedEvent[],
  asOf: string,
): NormalizedEvent | null {
  const lifecycleEvents = events
    .filter(
      (e) =>
        TICKET_SOURCE_SYSTEMS.has(e.system) &&
        TICKET_LIFECYCLE_EVENT_TYPES.has(e.type) &&
        e.occurredAt <= asOf,
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  let closure: NormalizedEvent | null = null;
  for (const event of lifecycleEvents) {
    if (event.type !== "case_closed") closure = null;
    else closure ??= event;
  }
  return closure;
}

/**
 * The event that completed a first-response commitment as of `asOf`: the
 * first ticket-source `agent_replied`, or the first ticket-source
 * `case_closed` when the case was closed before any agent replied —
 * whichever came first. Null while neither has happened.
 *
 * Unlike a resolution, a first response happens once: a case reopened after
 * the reply (or after a reply-less close) never reopens its first-response
 * commitment, so this deliberately ignores later reopens rather than using
 * `findCaseCloseEvent`'s current-closure rule.
 */
export function findFirstResponseEvent(
  events: NormalizedEvent[],
  asOf: string,
): NormalizedEvent | null {
  let first: NormalizedEvent | null = null;
  for (const event of events) {
    if (!TICKET_SOURCE_SYSTEMS.has(event.system)) continue;
    if (event.type !== "agent_replied" && event.type !== "case_closed") continue;
    if (event.occurredAt > asOf) continue;
    if (!first || event.occurredAt < first.occurredAt) first = event;
  }
  return first;
}

/**
 * The event that completed a commitment of `kind` as of `asOf`, or null
 * while it is still open: the first agent reply for `first_response`
 * (`findFirstResponseEvent`), the case's current close for `resolution`
 * (`findCaseCloseEvent`). This is the only place commitment kinds differ —
 * both share the same pause rules and elapsed-time fold.
 */
export function findCompletionEvent(
  kind: CommitmentKind,
  events: NormalizedEvent[],
  asOf: string,
): NormalizedEvent | null {
  return kind === "first_response"
    ? findFirstResponseEvent(events, asOf)
    : findCaseCloseEvent(events, asOf);
}

/**
 * Where a commitment's SLA clock stops as of `asOf`: the completion instant
 * if the commitment is complete (`findCompletionEvent`), otherwise `asOf`
 * itself. The single cutoff rule `evaluateCommitment` and
 * `computeBreachedAt` both use, so the status and the breach instant can
 * never disagree about when the clock stopped.
 */
export function resolveClockCutoff(
  kind: CommitmentKind,
  events: NormalizedEvent[],
  asOf: string,
): { completionEvent: NormalizedEvent | null; cutoff: string } {
  const completionEvent = findCompletionEvent(kind, events, asOf);
  const cutoff =
    completionEvent && completionEvent.occurredAt < asOf ? completionEvent.occurredAt : asOf;
  return { completionEvent, cutoff };
}

/**
 * Evaluates a Commitment's current status as of `asOf`.
 *
 * Pure and deterministic (Phase 13.8): the same
 * `(commitment, events, policyVersion, calendar, asOf)` always produces an
 * identical `Evaluation`, id included. A breach is not a separate concept —
 * it is simply an Evaluation whose status is `"breached"`.
 *
 * Status transitions: `on_track → at_risk → met | breached`, driven by
 * `policyVersion.warnAtPercent` thresholds and, once the commitment's
 * completion event is observed (`findCompletionEvent` — the first agent
 * reply for first response, the case close for resolution), by whether it
 * happened inside or past the target.
 */
export function evaluateCommitment(
  commitment: Commitment,
  events: NormalizedEvent[],
  policyVersion: SLAPolicyVersion,
  calendar: BusinessCalendarVersion,
  asOf: string,
): Evaluation {
  const caseEvents = events
    .filter((e) => e.caseId === commitment.caseId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const { completionEvent, cutoff: effectiveAsOf } = resolveClockCutoff(
    commitment.kind,
    caseEvents,
    asOf,
  );

  const eventsUpToCutoff = caseEvents.filter(
    (e) => e.occurredAt <= effectiveAsOf,
  );
  const lastEvent =
    eventsUpToCutoff.length > 0
      ? eventsUpToCutoff[eventsUpToCutoff.length - 1]!
      : null;

  const fold = foldClockIntervals(
    caseEvents,
    policyVersion.pauseOnStates,
    effectiveAsOf,
  );
  const elapsedWorkingMinutes = sumRunningWorkingMinutes(
    fold.runningIntervals,
    calendar,
  );
  const remainingMinutes = commitment.targetMinutes - elapsedWorkingMinutes;

  let status: CommitmentStatus;
  let warnThresholdCrossed: number | undefined;
  if (completionEvent) {
    status = remainingMinutes >= 0 ? "met" : "breached";
    if (status === "breached") warnThresholdCrossed = BREACH_NOTIFICATION_THRESHOLD;
  } else if (remainingMinutes <= 0) {
    status = "breached";
    warnThresholdCrossed = BREACH_NOTIFICATION_THRESHOLD;
  } else {
    const percentConsumed =
      (elapsedWorkingMinutes / commitment.targetMinutes) * 100;
    const highestCrossedThreshold = [...policyVersion.warnAtPercent]
      .sort((a, b) => b - a)
      .find((threshold) => percentConsumed >= threshold);
    status = highestCrossedThreshold !== undefined ? "at_risk" : "on_track";
    warnThresholdCrossed = highestCrossedThreshold;
  }

  const clockState: ClockState = completionEvent
    ? "stopped"
    : fold.currentPause
      ? "paused"
      : "running";

  let effectiveDueAt: string | null = null;
  if (status === "breached") {
    effectiveDueAt = targetCrossingInstant(
      fold.runningIntervals,
      commitment.targetMinutes,
      calendar,
    );
  } else if (clockState === "running") {
    effectiveDueAt = projectDeadline(effectiveAsOf, remainingMinutes, calendar);
  }

  const elapsedSeconds = toWholeSeconds(elapsedWorkingMinutes);
  const remainingSeconds = commitment.targetMinutes * 60 - elapsedSeconds;

  const inputs = {
    lastEvent: lastEvent ? toEventRef(lastEvent) : null,
    policyVersionId: policyVersion.id,
    calendarVersionId: calendar.id,
  };

  const lastEventKey = inputs.lastEvent
    ? `${inputs.lastEvent.sourceRawEventId}:${inputs.lastEvent.type}:${inputs.lastEvent.occurredAt}:${inputs.lastEvent.toState}`
    : null;
  const id = stableHash(
    `${commitment.id}|${lastEventKey}|${inputs.policyVersionId}|${inputs.calendarVersionId}|${asOf}`,
  );

  return {
    id,
    commitmentId: commitment.id,
    evaluatedAt: asOf,
    elapsedWorkingMinutes,
    remainingMinutes,
    status,
    breachedByMinutes: remainingMinutes < 0 ? -remainingMinutes : undefined,
    elapsedSeconds,
    remainingSeconds,
    breachedBySeconds: remainingSeconds < 0 ? -remainingSeconds : undefined,
    clock: {
      state: clockState,
      pausedSince: clockState === "paused" ? fold.currentPause!.since : null,
      pauseCause: clockState === "paused" ? fold.currentPause!.cause : null,
    },
    effectiveDueAt,
    warnThresholdCrossed,
    inputs,
  };
}

/**
 * Whole seconds in a working-minute count, rounded down. Event timestamps
 * are millisecond-precise, so the tolerance only absorbs floating-point
 * drift from summing minute fractions (e.g. 33.99999999997 → 34), never a
 * real fraction of a second.
 */
function toWholeSeconds(minutes: number): number {
  return Math.floor(minutes * 60 + 1e-6);
}

function toEventRef(event: NormalizedEvent): EvaluationEventRef {
  return {
    sourceRawEventId: event.sourceRawEventId,
    system: event.system,
    type: event.type,
    occurredAt: event.occurredAt,
    toState: event.toState,
  };
}

/**
 * The deadline if the clock keeps running from `from`. Null when the calendar
 * has no working time within `computeDeadline`'s search horizon — a
 * misconfigured calendar must not make the evaluation itself fail, since
 * elapsed time and status never depended on it.
 */
function projectDeadline(
  from: string,
  remainingMinutes: number,
  calendar: BusinessCalendarVersion,
): string | null {
  try {
    return computeDeadline(from, remainingMinutes, calendar).toISOString();
  } catch {
    return null;
  }
}

/**
 * The instant the running clock first accumulated `targetMinutes` working
 * minutes across `runningIntervals`.
 */
function targetCrossingInstant(
  runningIntervals: { start: Date; end: Date }[],
  targetMinutes: number,
  calendar: BusinessCalendarVersion,
): string | null {
  let remaining = targetMinutes;
  for (const interval of runningIntervals) {
    const available = workingMinutesBetween(interval.start, interval.end, calendar);
    if (available >= remaining) {
      return computeDeadline(interval.start, remaining, calendar).toISOString();
    }
    remaining -= available;
  }

  // Only reachable through floating-point drift when elapsed lands exactly
  // on the target at the cutoff: the crossing is the end of the last
  // running interval.
  const last = runningIntervals[runningIntervals.length - 1];
  return last ? last.end.toISOString() : null;
}

/**
 * The instant a commitment actually breached: the moment its running SLA
 * clock (working minutes per `calendar`, excluding `pauseOnStates` pauses)
 * first reached `targetMinutes`. `null` unless `evaluateCommitment` reports
 * the commitment `breached` as of `asOf` — a met, on-track or at-risk
 * commitment has no breach instant.
 *
 * Derived from events, never stored ("store events, never store computed
 * time"), and independent of when it was evaluated: a later `asOf` (the
 * next poll, a reconciliation sweep days later) returns the same instant,
 * because the clock's running intervals before the crossing don't change.
 * Only new or corrected events before that instant can move it, which is
 * the point. `Commitment.dueAt` isn't this: it's frozen at creation and
 * ignores pauses.
 *
 * Consistent with `evaluateCommitment`'s own boundary: an open commitment
 * is breached once elapsed reaches the target, so the crossing can be the
 * `asOf` instant itself; a completed one only once it strictly exceeds the
 * target before completing, so the crossing is always before completion.
 */
export function computeBreachedAt(
  commitment: Commitment,
  events: NormalizedEvent[],
  policyVersion: SLAPolicyVersion,
  calendar: BusinessCalendarVersion,
  asOf: string,
): string | null {
  const evaluation = evaluateCommitment(commitment, events, policyVersion, calendar, asOf);
  return evaluation.status === "breached" ? evaluation.effectiveDueAt : null;
}
