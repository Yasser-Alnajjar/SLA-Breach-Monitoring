import { computeElapsedWorkingMinutes } from "./elapsed";
import type {
  BusinessCalendarVersion,
  Commitment,
  CommitmentStatus,
  Evaluation,
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

/** Event types that carry Zendesk's own view of the case's lifecycle state. */
const ZENDESK_LIFECYCLE_EVENT_TYPES = new Set<NormalizedEvent["type"]>([
  "case_created",
  "state_changed",
  "case_closed",
]);

/**
 * The event that determines whether a case is open or closed as of `asOf`:
 * the most recent Zendesk-origin lifecycle event, if any, or null if none
 * has happened yet or the case is currently open.
 *
 * Only Zendesk ever anchors a case's lifecycle — a linked Jira issue is
 * never the anchor, and its normalizer never emits `case_created`/
 * `case_closed` (packages/jira/src/normalize.ts) — so a Jira transition
 * (e.g. reaching its own "done" category) can never close or reopen a case
 * here, regardless of when it lands relative to Zendesk's own events.
 *
 * Looking at the *most recent* lifecycle event, not merely "did a
 * case_closed ever happen", is what lets a Zendesk ticket that was solved
 * and later reopened correctly resume SLA tracking instead of staying
 * permanently resolved.
 */
export function findCaseCloseEvent(
  events: NormalizedEvent[],
  asOf: string,
): NormalizedEvent | null {
  const lifecycleEvents = events
    .filter(
      (e) =>
        e.system === "zendesk" &&
        ZENDESK_LIFECYCLE_EVENT_TYPES.has(e.type) &&
        e.occurredAt <= asOf,
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const last = lifecycleEvents[lifecycleEvents.length - 1];
  return last && last.type === "case_closed" ? last : null;
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
 * `policyVersion.warnAtPercent` thresholds and, once a `case_closed` event
 * is observed, by whether the close happened inside or past the target.
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

  const closeEvent = findCaseCloseEvent(caseEvents, asOf);
  const effectiveAsOf =
    closeEvent && closeEvent.occurredAt < asOf ? closeEvent.occurredAt : asOf;

  const eventsUpToCutoff = caseEvents.filter(
    (e) => e.occurredAt <= effectiveAsOf,
  );
  const lastEvent =
    eventsUpToCutoff.length > 0
      ? eventsUpToCutoff[eventsUpToCutoff.length - 1]!
      : null;

  const { elapsedWorkingMinutes } = computeElapsedWorkingMinutes(
    caseEvents,
    policyVersion.pauseOnStates,
    calendar,
    effectiveAsOf,
  );
  const remainingMinutes = commitment.targetMinutes - elapsedWorkingMinutes;

  let status: CommitmentStatus;
  let warnThresholdCrossed: number | undefined;
  if (closeEvent) {
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

  const inputs = {
    lastEventId: lastEvent?.id ?? null,
    policyVersionId: policyVersion.id,
    calendarVersionId: calendar.id,
  };

  const id = stableHash(
    `${commitment.id}|${inputs.lastEventId}|${inputs.policyVersionId}|${inputs.calendarVersionId}|${asOf}`,
  );

  return {
    id,
    commitmentId: commitment.id,
    evaluatedAt: asOf,
    elapsedWorkingMinutes,
    remainingMinutes,
    status,
    breachedByMinutes: remainingMinutes < 0 ? -remainingMinutes : undefined,
    warnThresholdCrossed,
    inputs,
  };
}
