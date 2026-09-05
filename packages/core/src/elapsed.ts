import { workingMinutesBetween } from "./calendar";
import type {
  BusinessCalendarVersion,
  ElapsedResult,
  NormalizedEvent,
  NormalizedState,
  PausedInterval,
} from "./types";

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
  if (events.length === 0) {
    return { elapsedWorkingMinutes: 0, pausedIntervals: [] };
  }

  const pauseSet = new Set(pauseOnStates);
  const sorted = [...events].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  const cutoff = asOf
    ? typeof asOf === "string"
      ? new Date(asOf)
      : asOf
    : new Date(sorted[sorted.length - 1]!.occurredAt);

  const runningIntervals: { start: Date; end: Date }[] = [];
  const pausedIntervals: PausedInterval[] = [];

  let currentlyPaused = false;
  let pauseCause: NormalizedState | null = null;
  let segmentStart = new Date(sorted[0]!.occurredAt);

  const closeSegment = (end: Date) => {
    if (end <= segmentStart) return;
    if (currentlyPaused) {
      pausedIntervals.push({
        start: segmentStart.toISOString(),
        end: end.toISOString(),
        cause: pauseCause!,
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

    const shouldBePaused = pauseSet.has(event.toState);
    if (shouldBePaused === currentlyPaused) continue;

    closeSegment(occurredAt);
    segmentStart = occurredAt;
    currentlyPaused = shouldBePaused;
    pauseCause = shouldBePaused ? event.toState : null;
  }

  closeSegment(cutoff);

  const elapsedWorkingMinutes = runningIntervals.reduce(
    (sum, interval) =>
      sum + workingMinutesBetween(interval.start, interval.end, calendar),
    0,
  );

  return { elapsedWorkingMinutes, pausedIntervals };
}
