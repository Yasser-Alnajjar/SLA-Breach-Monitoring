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

  const closeEvent =
    caseEvents.find((e) => e.type === "case_closed" && e.occurredAt <= asOf) ??
    null;
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
  if (closeEvent) {
    status = remainingMinutes >= 0 ? "met" : "breached";
  } else if (remainingMinutes <= 0) {
    status = "breached";
  } else {
    const percentConsumed =
      (elapsedWorkingMinutes / commitment.targetMinutes) * 100;
    const highestCrossedThreshold = [...policyVersion.warnAtPercent]
      .sort((a, b) => b - a)
      .find((threshold) => percentConsumed >= threshold);
    status = highestCrossedThreshold !== undefined ? "at_risk" : "on_track";
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
    inputs,
  };
}
