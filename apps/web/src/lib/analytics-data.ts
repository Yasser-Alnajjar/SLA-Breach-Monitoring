import type { PrismaClient } from "@sla/db";
import {
  computeBreachedAt,
  deriveLegSpans,
  legAtTime,
  type BusinessCalendarVersion,
  type Commitment,
  type CommitmentKind,
  type CommitmentStatus,
  type Leg,
  type NormalizedEvent,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";
import { toCommitmentDomain, toNormalizedEventDomain } from "@sla/commitments";
import type {
  BreachedCaseRow,
  BreachesByStageRow,
  BreachesOverTimeLegPoint,
  BreachesOverTimePoint,
  ComplianceTrendPoint,
  ProjectAnalyticsData,
  SlaComplianceBreakdown,
} from "./types/dashboard";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function everyDayInRange(periodStart: Date, asOfDate: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()),
  );
  while (cursor.getTime() <= end.getTime()) {
    days.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Buckets breach instants by UTC day across [periodStart, asOfDate]
 * inclusive, defaulting every day in range to 0 — a quiet day is a real
 * zero on the line chart, not a gap.
 */
export function bucketBreachesByDay(
  breachedAtDates: Date[],
  periodStart: Date,
  asOfDate: Date,
): BreachesOverTimePoint[] {
  const counts = new Map<string, number>();
  for (const date of breachedAtDates) {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: BreachesOverTimePoint[] = [];
  const cursor = new Date(
    Date.UTC(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth(),
      periodStart.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()),
  );
  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor);
    points.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

/**
 * The Breaches Over Time chart's Support/Engineering split (dashboard
 * reconstruction, Stitch `elapsed_dashboard`): same day-bucketing as
 * `bucketBreachesByDay`, but each breach is additionally attributed to
 * whichever leg owned the case at the instant it breached. Kept as its own
 * function rather than changing `bucketBreachesByDay`'s return shape, since
 * that shape is a tested contract for the plain breach-count chart.
 */
export function bucketBreachesByDayAndLeg(
  breaches: { breachedAt: Date; leg: Leg }[],
  periodStart: Date,
  asOfDate: Date,
): BreachesOverTimeLegPoint[] {
  const supportCounts = new Map<string, number>();
  const engineeringCounts = new Map<string, number>();
  for (const { breachedAt, leg } of breaches) {
    const key = dayKey(breachedAt);
    const bucket = leg === "engineering" ? engineeringCounts : supportCounts;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  return everyDayInRange(periodStart, asOfDate).map((date) => ({
    date,
    supportCount: supportCounts.get(date) ?? 0,
    engineeringCount: engineeringCounts.get(date) ?? 0,
  }));
}

/**
 * The "SLA Compliance Trend" chart's time series (dashboard reconstruction):
 * for each day in range, the met-vs-breached rate among commitments closed
 * in the trailing 7 days ending that day. A day with nothing closed in its
 * trailing window is `null` — a real gap, never interpolated or fabricated.
 */
export function computeComplianceTrend(
  closedRows: { status: CommitmentStatus; closedAt: Date }[],
  periodStart: Date,
  asOfDate: Date,
): ComplianceTrendPoint[] {
  const TRAILING_WINDOW_DAYS = 7;
  return everyDayInRange(periodStart, asOfDate).map((date) => {
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const windowStart = new Date(dayEnd.getTime() - TRAILING_WINDOW_DAYS * 86_400_000);
    const windowRows = closedRows.filter(
      (row) => row.closedAt > windowStart && row.closedAt <= dayEnd,
    );
    const relevant = windowRows.filter((r) => r.status === "met" || r.status === "breached");
    if (relevant.length === 0) return { date, compliancePercent: null };
    const met = relevant.filter((r) => r.status === "met").length;
    return {
      date,
      compliancePercent: Math.round((met / relevant.length) * 1000) / 10,
    };
  });
}

export interface BreachOccurrence {
  commitmentId: string;
  caseId: string;
  kind: CommitmentKind;
  caseOpenedAt: Date;
  breachedAt: Date;
}

/**
 * The commitments that actually breached inside [periodStart, asOfDate],
 * each with the instant its SLA clock crossed the target
 * (`computeBreachedAt`: calendar- and pause-aware, derived from events).
 * Deliberately not `Evaluation.evaluatedAt`: that's when the worker looked,
 * so a historical import or a reconciliation sweep would pile every old
 * breach onto the day it ran. Commitments whose policy or calendar version
 * isn't loaded are skipped, as on the rest of the dashboard.
 */
export function findBreachesInPeriod(
  candidates: { commitment: Commitment; caseOpenedAt: Date }[],
  eventsByCaseId: ReadonlyMap<string, NormalizedEvent[]>,
  policyVersionsById: ReadonlyMap<string, SLAPolicyVersion>,
  calendarsById: ReadonlyMap<string, BusinessCalendarVersion>,
  periodStart: Date,
  asOfDate: Date,
): BreachOccurrence[] {
  const asOf = asOfDate.toISOString();
  const breaches: BreachOccurrence[] = [];
  for (const { commitment, caseOpenedAt } of candidates) {
    const policyVersion = policyVersionsById.get(commitment.policyVersionId);
    const calendar = calendarsById.get(commitment.calendarVersionId);
    if (!policyVersion || !calendar) continue;

    const breachedAtIso = computeBreachedAt(
      commitment,
      eventsByCaseId.get(commitment.caseId) ?? [],
      policyVersion,
      calendar,
      asOf,
    );
    if (breachedAtIso === null) continue;
    const breachedAt = new Date(breachedAtIso);
    if (breachedAt < periodStart || breachedAt > asOfDate) continue;

    breaches.push({
      commitmentId: commitment.id,
      caseId: commitment.caseId,
      kind: commitment.kind,
      caseOpenedAt,
      breachedAt,
    });
  }
  return breaches.sort((a, b) => a.breachedAt.getTime() - b.breachedAt.getTime());
}

/**
 * The dashboard's "breached this period" list (and so its breach KPI, which
 * is the list's length): one row per breach from `findBreachesInPeriod`, the
 * same set the Breaches Over Time chart buckets, so the two always agree.
 * A breach whose case details are missing is dropped rather than rendered
 * half-empty.
 */
export function toBreachedCaseRows(
  breaches: BreachOccurrence[],
  caseDetailsById: ReadonlyMap<
    string,
    { externalId: string; subject: string | null; customerName: string | null }
  >,
): BreachedCaseRow[] {
  const rows: BreachedCaseRow[] = [];
  for (const breach of breaches) {
    const details = caseDetailsById.get(breach.caseId);
    if (!details) continue;
    rows.push({
      commitmentId: breach.commitmentId,
      caseId: breach.caseId,
      externalId: details.externalId,
      customerName: details.customerName,
      kind: breach.kind,
      subject: details.subject,
    });
  }
  return rows;
}

type ComplianceBucket = "met" | "at_risk" | "breached";
const SEVERITY_RANK: Record<ComplianceBucket, number> = {
  met: 0,
  at_risk: 1,
  breached: 2,
};

function bucketOf(status: CommitmentStatus): ComplianceBucket | null {
  if (status === "breached") return "breached";
  if (status === "at_risk") return "at_risk";
  if (status === "on_track" || status === "met") return "met";
  return null; // cancelled — doesn't reflect an SLA outcome
}

/**
 * Worst-status-wins per case: a case with one breached and one on-track
 * commitment counts as breached, not split across two buckets. Cases whose
 * only commitments are cancelled are excluded from the total.
 */
export function summarizeCompliance(
  commitmentStatuses: { caseId: string; status: CommitmentStatus }[],
): SlaComplianceBreakdown {
  const worstByCaseId = new Map<string, ComplianceBucket>();
  for (const { caseId, status } of commitmentStatuses) {
    const bucket = bucketOf(status);
    if (bucket === null) continue;
    const existing = worstByCaseId.get(caseId);
    if (!existing || SEVERITY_RANK[bucket] > SEVERITY_RANK[existing]) {
      worstByCaseId.set(caseId, bucket);
    }
  }

  let metSla = 0;
  let atRisk = 0;
  let breached = 0;
  for (const bucket of worstByCaseId.values()) {
    if (bucket === "met") metSla++;
    else if (bucket === "at_risk") atRisk++;
    else breached++;
  }

  return { metSla, atRisk, breached, total: worstByCaseId.size };
}

/**
 * Assembles the Project Analytics section (SLA Compliance, Breaches Over
 * Time, Breaches by Stage). `openCommitmentStatuses` and
 * `closedPeriodCommitmentStatuses` are passed in from `getDashboardData`,
 * which already fetches them for the KPI tiles — reusing them here avoids a
 * duplicate query. Breach timing/stage attribution needs its own queries:
 * it covers closed commitments too, which the dashboard doesn't load. The
 * breaches found are also returned as `breachedThisPeriod` rows, so the
 * dashboard's breach KPI and list reuse them instead of querying again.
 */
export async function getProjectAnalytics(
  prisma: PrismaClient,
  organizationId: string,
  periodStart: Date,
  asOfDate: Date,
  openCommitmentStatuses: { caseId: string; status: CommitmentStatus }[],
  closedPeriodCommitmentStatuses: { caseId: string; status: CommitmentStatus; closedAt?: Date | null }[],
): Promise<{ analytics: ProjectAnalyticsData; breachedThisPeriod: BreachedCaseRow[] }> {
  const compliance = summarizeCompliance([
    ...openCommitmentStatuses,
    ...closedPeriodCommitmentStatuses,
  ]);

  // Candidates: every open commitment (breach state is computed live, like
  // the at-risk list) plus closed ones stored as breached that closed inside
  // the period. A breach always precedes its commitment's close, so one
  // that closed before periodStart can't have breached inside the period.
  const commitmentRows = await prisma.commitment.findMany({
    where: {
      case: { organizationId, deletedAt: null },
      startedAt: { lte: asOfDate },
      OR: [
        { closedAt: null },
        { status: "breached", closedAt: { gte: periodStart } },
      ],
    },
    include: {
      case: {
        select: {
          openedAt: true,
          externalId: true,
          subject: true,
          customer: { select: { name: true } },
        },
      },
    },
  });

  const policyVersionIds = [...new Set(commitmentRows.map((c) => c.policyVersionId))];
  const calendarVersionIds = [...new Set(commitmentRows.map((c) => c.calendarVersionId))];
  const candidateCaseIds = [...new Set(commitmentRows.map((c) => c.caseId))];

  const [policyVersionRows, calendarVersionRows, eventRows] =
    commitmentRows.length > 0
      ? await Promise.all([
          prisma.sLAPolicyVersion.findMany({ where: { id: { in: policyVersionIds } } }),
          prisma.businessCalendarVersion.findMany({ where: { id: { in: calendarVersionIds } } }),
          prisma.normalizedEvent.findMany({ where: { caseId: { in: candidateCaseIds } } }),
        ])
      : [[], [], []];

  const policyVersionsById = new Map<string, SLAPolicyVersion>(
    policyVersionRows.map((row) => [
      row.id,
      {
        id: row.id,
        policyId: row.policyId,
        version: row.version,
        match: row.match as SLAPolicyMatch,
        targets: row.targets as { kind: CommitmentKind; minutes: number }[],
        pauseOnStates: row.pauseOnStates as NormalizedState[],
        calendarVersionId: row.calendarVersionId,
        warnAtPercent: row.warnAtPercent,
        effectiveFrom: row.effectiveFrom.toISOString(),
      },
    ]),
  );

  const calendarsById = new Map<string, BusinessCalendarVersion>(
    calendarVersionRows.map((row) => [
      row.id,
      {
        id: row.id,
        version: row.version,
        timezone: row.timezone,
        weekly: row.weekly as unknown as WeeklyWindow[],
        holidays: row.holidays,
        alwaysOpen: row.alwaysOpen,
      },
    ]),
  );

  const eventsByCaseId = new Map<string, NormalizedEvent[]>();
  for (const row of eventRows) {
    const domainEvent = toNormalizedEventDomain(row);
    const existing = eventsByCaseId.get(row.caseId);
    if (existing) existing.push(domainEvent);
    else eventsByCaseId.set(row.caseId, [domainEvent]);
  }

  const breaches = findBreachesInPeriod(
    commitmentRows.map((row) => ({
      commitment: toCommitmentDomain(row),
      caseOpenedAt: row.case.openedAt,
    })),
    eventsByCaseId,
    policyVersionsById,
    calendarsById,
    periodStart,
    asOfDate,
  );

  const breachesOverTime = bucketBreachesByDay(
    breaches.map((b) => b.breachedAt),
    periodStart,
    asOfDate,
  );

  const legCounts = new Map<Leg, number>();
  const breachLegs: { breachedAt: Date; leg: Leg }[] = [];
  for (const breach of breaches) {
    const { spans } = deriveLegSpans(eventsByCaseId.get(breach.caseId) ?? [], {
      caseOpenedAt: breach.caseOpenedAt.toISOString(),
    });
    const leg = legAtTime(spans, breach.breachedAt.toISOString());
    legCounts.set(leg, (legCounts.get(leg) ?? 0) + 1);
    breachLegs.push({ breachedAt: breach.breachedAt, leg });
  }

  const breachesByStage: BreachesByStageRow[] = [...legCounts.entries()]
    .map(([leg, count]) => ({ leg, count }))
    .sort((a, b) => b.count - a.count);

  const breachesOverTimeByLeg = bucketBreachesByDayAndLeg(breachLegs, periodStart, asOfDate);

  const complianceTrend = computeComplianceTrend(
    closedPeriodCommitmentStatuses.filter(
      (row): row is { caseId: string; status: CommitmentStatus; closedAt: Date } =>
        row.closedAt != null,
    ),
    periodStart,
    asOfDate,
  );

  const breachedThisPeriod = toBreachedCaseRows(
    breaches,
    new Map(
      commitmentRows.map((row) => [
        row.caseId,
        {
          externalId: row.case.externalId,
          subject: row.case.subject,
          customerName: row.case.customer?.name ?? null,
        },
      ]),
    ),
  );

  return {
    analytics: { compliance, breachesOverTime, breachesOverTimeByLeg, breachesByStage, complianceTrend },
    breachedThisPeriod,
  };
}
