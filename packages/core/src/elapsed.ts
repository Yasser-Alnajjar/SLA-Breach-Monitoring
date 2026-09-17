import { workingMinutesBetween } from "./calendar";
import { sortNormalizedEvents } from "./ordering";
import type {
  BusinessCalendarVersion,
  ClockFold,
  ClockWindow,
  ElapsedResult,
  NormalizedEvent,
  NormalizedState,
  PausedInterval,
} from "./types";

/**
 * Folds the ordered normalized-event stream into alternating running/paused
 * wall-clock intervals inside `window`, based on `pauseOnStates` (semantic
 * states, never provider strings). Shared by `computeElapsedWorkingMinutes`
 * and `evaluateCommitment`/`computeBreachedAt` (evaluate.ts) so the SLA clock
 * and the breach instant can never disagree about when the clock was running.
 *
 * The window is always explicit: the clock never starts at the case's first
 * event nor stops at its last one. Events before `window.start` are replayed
 * for state only — they decide whether the clock is paused when the window
 * opens, but no interval ever starts before `window.start`. Events after
 * `window.end` are ignored. An empty or inverted window yields no intervals.
 *
 * Each reporting system's latest state is tracked separately, and the clock
 * is paused while *any* system's latest state is a pause state (Phase 13.4:
 * customer-caused waiting pauses "regardless of which system reports it").
 * A system only ever ends its own pause — a linked Jira issue moving to
 * `in_progress` says nothing about whether the Zendesk ticket is still
 * waiting on the customer, so it can't end a Zendesk `pending_customer`
 * pause.
 *
 * `currentPause` is the clock's state at `window.end`: the pause still open
 * when the fold ends, or null while running. Its `since` is when that pause
 * actually began, even if that was before `window.start` — only the
 * intervals are clipped to the window.
 */
export function foldClockIntervals(
  events: NormalizedEvent[],
  pauseOnStates: NormalizedState[],
  window: ClockWindow,
): ClockFold {
  const runningIntervals: { start: Date; end: Date }[] = [];
  const pausedIntervals: PausedInterval[] = [];

  const pauseSet = new Set(pauseOnStates);
  const windowStart = new Date(window.start);
  const windowEnd = new Date(window.end);

  // Latest pause state per system; a system is absent while not pausing.
  const pausingStateBySystem = new Map<NormalizedEvent["system"], NormalizedState>();
  let pauseCause: NormalizedState | null = null;
  let pausedSince: Date | null = null;
  let segmentStart = windowStart;

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

  for (const event of sortNormalizedEvents(events)) {
    const occurredAt = new Date(event.occurredAt);
    if (occurredAt > windowEnd) break;
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

    // A flip before the window only changes the state the window opens in.
    const boundary = occurredAt < windowStart ? windowStart : occurredAt;
    closeSegment(boundary);
    segmentStart = boundary;
    pauseCause = shouldBePaused ? event.toState : null;
    pausedSince = shouldBePaused ? occurredAt : null;
  }

  closeSegment(windowEnd);

  return {
    runningIntervals,
    pausedIntervals,
    currentPause:
      pauseCause && pausedSince
        ? { since: pausedSince.toISOString(), cause: pauseCause }
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
 * intervals inside `window` (`foldClockIntervals`), based on `pauseOnStates`
 * (semantic states, never provider strings), then intersects the running intervals with working hours and
 * sums.
 *
 * The pause predicate looks at every event regardless of which system
 * reported it — the customer-facing commitment pauses only on
 * customer-caused waiting, and that fact can arrive from either system
 * (Phase 13.4). `legs.ts` makes a narrower, helpdesk-only judgment for leg
 * *attribution*; this function's pause set is the SLA clock's own rule and
 * is deliberately broader.
 *
 * Pure and deterministic: the same `(events, pauseOnStates, calendar, window)`
 * always returns the same result.
 */
export function computeElapsedWorkingMinutes(
  events: NormalizedEvent[],
  pauseOnStates: NormalizedState[],
  calendar: BusinessCalendarVersion,
  window: ClockWindow,
): ElapsedResult {
  const { runningIntervals, pausedIntervals } = foldClockIntervals(
    events,
    pauseOnStates,
    window,
  );

  const elapsedWorkingMinutes = sumRunningWorkingMinutes(runningIntervals, calendar);

  return { elapsedWorkingMinutes, pausedIntervals };
}
