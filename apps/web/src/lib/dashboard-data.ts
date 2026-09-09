import type { PrismaClient } from "@sla/db";
import {
  deriveLegSpans,
  evaluateCommitment,
  evaluateEngineeringLegTarget,
  sumLegMinutes,
  type BusinessCalendarVersion,
  type CommitmentKind,
  type CommitmentStatus,
  type EngineeringLegEvaluation,
  type Leg,
  type LegSpan,
  type NormalizedEvent,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";
import { toCommitmentDomain, toNormalizedEventDomain } from "@sla/commitments";
import type { AgingEscalationRow, AtRiskRow, BreachedCaseRow, DashboardData } from "./types/dashboard";

// "Period" for the two reporting metrics (breach count, compliance %) is a
// trailing 30-day window rather than a calendar month — it needs no
// timezone decision per organization and never shows a partial period.
const PERIOD_DAYS = 30;
// The wall-monitor screen this feeds must be readable without scrolling
// (Phase 17), so each list is capped and reports how much it left out.
const AT_RISK_LIMIT = 12;
const AGING_LIMIT = 8;

function minutesBetween(from: string, to: Date): number {
  return Math.round((to.getTime() - new Date(from).getTime()) / 60000);
}

function complianceOf(rows: { status: CommitmentStatus }[]): number | null {
  if (rows.length === 0) return null;
  const met = rows.filter((r) => r.status === "met").length;
  return Math.round((met / rows.length) * 1000) / 10;
}

/**
 * Assembles the one-screen dashboard (Phase 17). The at-risk list and the
 * engineering-aging list are computed live with `evaluateCommitment` /
 * `deriveLegSpans` — the same pure functions the worker uses — because
 * `remainingMinutes` is derived, never stored (schema.prisma's rule), and an
 * `Evaluation` row is only a transition snapshot, not a per-minute reading.
 * The breach count and compliance % read persisted, worker-maintained state
 * instead: they're scoped to a trailing period of things that already
 * happened, not "right now".
 */
export async function getDashboardData(
  prisma: PrismaClient,
  organizationId: string,
  asOfDate: Date = new Date(),
): Promise<DashboardData> {
  const asOf = asOfDate.toISOString();
  const periodStart = new Date(asOfDate.getTime() - PERIOD_DAYS * 86_400_000);
  const previousPeriodStart = new Date(periodStart.getTime() - PERIOD_DAYS * 86_400_000);

  const [openCommitmentRows, breachedEvaluationRows, currentPeriodClosedRows, previousPeriodClosedRows, organization] =
    await Promise.all([
      prisma.commitment.findMany({
        where: { case: { organizationId }, closedAt: null },
        include: { case: { include: { customer: true } } },
      }),
      prisma.evaluation.findMany({
        where: { status: "breached", evaluatedAt: { gte: periodStart }, commitment: { case: { organizationId } } },
        distinct: ["commitmentId"],
        select: { commitmentId: true },
      }),
      prisma.commitment.findMany({
        where: {
          case: { organizationId },
          closedAt: { gte: periodStart, lte: asOfDate },
          status: { in: ["met", "breached"] },
        },
        select: { status: true },
      }),
      prisma.commitment.findMany({
        where: {
          case: { organizationId },
          closedAt: { gte: previousPeriodStart, lt: periodStart },
          status: { in: ["met", "breached"] },
        },
        select: { status: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { engineeringLegTargetMinutes: true },
      }),
    ]);

  const engineeringLegTargetMinutes = organization?.engineeringLegTargetMinutes ?? null;

  const policyVersionIds = [...new Set(openCommitmentRows.map((c) => c.policyVersionId))];
  const calendarVersionIds = [...new Set(openCommitmentRows.map((c) => c.calendarVersionId))];
  const caseIds = [...new Set(openCommitmentRows.map((c) => c.caseId))];

  const [policyVersionRows, calendarVersionRows, eventRows, breachedCommitmentRows] = await Promise.all([
    policyVersionIds.length > 0
      ? prisma.sLAPolicyVersion.findMany({ where: { id: { in: policyVersionIds } } })
      : Promise.resolve([]),
    calendarVersionIds.length > 0
      ? prisma.businessCalendarVersion.findMany({ where: { id: { in: calendarVersionIds } } })
      : Promise.resolve([]),
    caseIds.length > 0 ? prisma.normalizedEvent.findMany({ where: { caseId: { in: caseIds } } }) : Promise.resolve([]),
    breachedEvaluationRows.length > 0
      ? prisma.commitment.findMany({
          where: { id: { in: breachedEvaluationRows.map((e) => e.commitmentId) } },
          include: { case: { include: { customer: true } } },
        })
      : Promise.resolve([]),
  ]);

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

  const legSpansByCaseId = new Map<string, LegSpan[]>();
  const legSpansFor = (caseId: string, caseOpenedAt: Date): LegSpan[] => {
    const cached = legSpansByCaseId.get(caseId);
    if (cached) return cached;
    const { spans } = deriveLegSpans(eventsByCaseId.get(caseId) ?? [], {
      caseOpenedAt: caseOpenedAt.toISOString(),
    });
    legSpansByCaseId.set(caseId, spans);
    return spans;
  };

  const atRisk: AtRiskRow[] = [];
  const otherOpenCommitments: AtRiskRow[] = [];
  const casesSeenForAging = new Set<string>();
  const agingInEngineering: AgingEscalationRow[] = [];

  for (const row of openCommitmentRows) {
    const policyVersion = policyVersionsById.get(row.policyVersionId);
    const calendar = calendarsById.get(row.calendarVersionId);
    if (!policyVersion || !calendar) continue;

    const events = eventsByCaseId.get(row.caseId) ?? [];
    const evaluation = evaluateCommitment(toCommitmentDomain(row), events, policyVersion, calendar, asOf);
    const spans = legSpansFor(row.caseId, row.case.openedAt);
    const currentSpan = spans[spans.length - 1];
    const currentLeg: Leg = currentSpan?.leg ?? "unknown";
    const minutesInCurrentLeg = currentSpan ? minutesBetween(currentSpan.startedAt, asOfDate) : 0;

    if (evaluation.status === "on_track" || evaluation.status === "at_risk" || evaluation.status === "breached") {
      atRisk.push({
        commitmentId: row.id,
        caseId: row.caseId,
        externalId: row.case.externalId,
        customerName: row.case.customer?.name ?? null,
        kind: row.kind,
        remainingMinutes: evaluation.remainingMinutes,
        status: evaluation.status,
        currentLeg,
        minutesInCurrentLeg,
      });
    } else {
      otherOpenCommitments.push({
        commitmentId: row.id,
        caseId: row.caseId,
        externalId: row.case.externalId,
        customerName: row.case.customer?.name ?? null,
        kind: row.kind,
        remainingMinutes: evaluation.remainingMinutes,
        status: evaluation.status,
        currentLeg,
        minutesInCurrentLeg,
      });
    }

    if (!casesSeenForAging.has(row.caseId)) {
      casesSeenForAging.add(row.caseId);
      if (currentLeg === "engineering") {
        const legTarget: EngineeringLegEvaluation | null =
          engineeringLegTargetMinutes !== null
            ? evaluateEngineeringLegTarget(
                sumLegMinutes(spans, "engineering", asOf),
                engineeringLegTargetMinutes,
                true,
              )
            : null;
        agingInEngineering.push({
          caseId: row.caseId,
          externalId: row.case.externalId,
          customerName: row.case.customer?.name ?? null,
          minutesInCurrentLeg,
          legTarget,
        });
      }
    }
  }

  atRisk.sort((a, b) => a.remainingMinutes - b.remainingMinutes);
  agingInEngineering.sort((a, b) => b.minutesInCurrentLeg - a.minutesInCurrentLeg);

  const breachedThisPeriod: BreachedCaseRow[] = breachedCommitmentRows.map((row) => ({
    caseId: row.caseId,
    externalId: row.case.externalId,
    customerName: row.case.customer?.name ?? null,
    kind: row.kind,
  }));

  return {
    asOf,
    periodDays: PERIOD_DAYS,
    atRisk: atRisk.slice(0, AT_RISK_LIMIT),
    atRiskOverflowCount: Math.max(0, atRisk.length - AT_RISK_LIMIT),
    otherOpenCommitments,
    breachedThisPeriod,
    agingInEngineering: agingInEngineering.slice(0, AGING_LIMIT),
    agingOverflowCount: Math.max(0, agingInEngineering.length - AGING_LIMIT),
    compliance: {
      current: complianceOf(currentPeriodClosedRows),
      previous: complianceOf(previousPeriodClosedRows),
    },
  };
}
