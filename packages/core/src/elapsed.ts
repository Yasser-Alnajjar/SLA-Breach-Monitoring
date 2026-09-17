import { workingMinutesBetween } from "./calendar";
import type {
  BusinessCalendarVersion,
  ClockFold,
  ElapsedResult,
  NormalizedEvent,
  NormalizedState,
  PausedInterval,
} from "./types";

/**
 * Folds the ordered normalized-event stream into alternating running/paused
 * wall-clock intervals up to `asOf`, based on `pauseOnStates` (semantic
 * states, never provider strings). Shared by `computeElapsedWorkingMinutes`
 * and `computeBreachedAt` (evaluate.ts) so the SLA clock and the breach
 * instant can never disagree about when the clock was running.
 *
 * Each reporting system's latest state is tracked separately, and the clock
 * is paused while *any* system's latest state is a pause state (Phase 13.4:
 * customer-caused waiting pauses "regardless of which system reports it").
 * A system only ever ends its own pause — a linked Jira issue moving to
 * `in_progress` says nothing about whether the Zendesk ticket is still
 * waiting on the customer, so it can't end a Zendesk `pending_customer`
 * pause.
 *
 * `currentPause` is the clock's state at the cutoff: the pause still open
 * when the fold ends (when it began and why), or null while running.
 */
export function foldClockIntervals(
  events: NormalizedEvent[],
  pauseOnStates: NormalizedState[],
  asOf?: Date | string,
): ClockFold {
  const runningIntervals: { start: Date; end: Date }[] = [];
  const pausedIntervals: PausedInterval[] = [];
  if (events.length === 0) return { runningIntervals, pausedIntervals, currentPause: null };

  const pauseSet = new Set(pauseOnStates);
  const sorted = [...events].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  const cutoff = asOf
    ? typeof asOf === "string"
      ? new Date(asOf)
      : asOf
    : new Date(sorted[sorted.length - 1]!.occurredAt);

  // Latest pause state per system; a system is absent while not pausing.
  const pausingStateBySystem = new Map<NormalizedEvent["system"], NormalizedState>();
  let pauseCause: NormalizedState | null = null;
  let segmentStart = new Date(sorted[0]!.occurredAt);

  const closeSegment = (end: Date) => {
    if (end <= segmentStart) return;
    if (pauseCause) {
      pausedIntervals.push({
        start: segmentStart.toISOString(),
        end: end.toISOString(),
        cause: pauseCause,
      });
    } else {
      runningIntervals.push({ start: segmentStart, end });
    }
  };

  for (const event of sorted) {
    const occurredAt = new Date(event.occurredAt);
    if (occurredAt > cutoff) break;
    if (event.type !== "state_changed" && event.type !== "case_created")
      continue;
    if (!event.toState) continue;

    if (pauseSet.has(event.toState)) {
      pausingStateBySystem.set(event.system, event.toState);
    } else {
      pausingStateBySystem.delete(event.system);
    }

    // Split only when the clock flips between running and paused; a second
    // system joining (or leaving) an ongoing pause doesn't split it.
    const shouldBePaused = pausingStateBySystem.size > 0;
    if (shouldBePaused === (pauseCause !== null)) continue;

    closeSegment(occurredAt);
    segmentStart = occurredAt;
    pauseCause = shouldBePaused ? event.toState : null;
  }

  closeSegment(cutoff);

  return {
    runningIntervals,
    pausedIntervals,
    currentPause: pauseCause
      ? { since: segmentStart.toISOString(), cause: pauseCause }
      : null,
  };
}

/**
 * Sums the working minutes of `foldClockIntervals`' running intervals — the
 * one elapsed-time rule `computeElapsedWorkingMinutes` and
 * `evaluateCommitment` both apply.
 */
export function sumRunningWorkingMinutes(
  runningIntervals: { start: Date; end: Date }[],
  calendar: BusinessCalendarVersion,
): number {
  return runningIntervals.reduce(
    (sum, interval) =>
      sum + workingMinutesBetween(interval.start, interval.end, calendar),
    0,
  );
}

/**
 * Folds the ordered normalized-event stream into alternating running/paused
 * intervals, based on `pauseOnStates` (semantic states, never provider
 * strings), then intersects the running intervals with working hours and
 * sums.
 *
 * The pause predicate looks at every event regardless of which system
 * reported it — the customer-facing commitment pauses only on
 * customer-caused waiting, and that fact can arrive from either system
 * (Phase 13.4). `legs.ts` makes a narrower, helpdesk-only judgment for leg
 * *attribution*; this function's pause set is the SLA clock's own rule and
 * is deliberately broader.
 *
 * Pure and deterministic: the same `(events, pauseOnStates, calendar, asOf)`
 * always returns the same result.
 */
export function computeElapsedWorkingMinutes(
  events: NormalizedEvent[],
  pauseOnStates: NormalizedState[],
  calendar: BusinessCalendarVersion,
  asOf?: Date | string,
): ElapsedResult {
  const { runningIntervals, pausedIntervals } = foldClockIntervals(
    events,
    pauseOnStates,
    asOf,
  );

  const elapsedWorkingMinutes = sumRunningWorkingMinutes(runningIntervals, calendar);

  return { elapsedWorkingMinutes, pausedIntervals };
}
