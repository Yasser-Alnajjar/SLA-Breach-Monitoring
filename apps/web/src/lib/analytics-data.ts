import type { PrismaClient } from "@sla/db";
import { deriveLegSpans, legAtTime, type CommitmentStatus, type Leg } from "@sla/core";
import { toNormalizedEventDomain } from "@sla/commitments";
import type {
  BreachesByStageRow,
  BreachesOverTimePoint,
  ProjectAnalyticsData,
  SlaComplianceBreakdown,
} from "./types/dashboard";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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
 * neither is derivable from data the dashboard already loads.
 */
export async function getProjectAnalytics(
  prisma: PrismaClient,
  organizationId: string,
  periodStart: Date,
  asOfDate: Date,
  openCommitmentStatuses: { caseId: string; status: CommitmentStatus }[],
  closedPeriodCommitmentStatuses: { caseId: string; status: CommitmentStatus }[],
): Promise<ProjectAnalyticsData> {
  const compliance = summarizeCompliance([
    ...openCommitmentStatuses,
    ...closedPeriodCommitmentStatuses,
  ]);

  const breachEvaluations = await prisma.evaluation.findMany({
    where: {
      status: "breached",
      evaluatedAt: { gte: periodStart, lte: asOfDate },
      commitment: { case: { organizationId, deletedAt: null } },
    },
    select: {
      commitmentId: true,
      evaluatedAt: true,
      commitment: {
        select: { caseId: true, case: { select: { openedAt: true } } },
      },
    },
    orderBy: { evaluatedAt: "asc" },
  });

  // A breached commitment keeps getting re-evaluated (still breached) on
  // every later poll — only its earliest breached evaluation is the actual
  // breach instant, so first-occurrence-wins per commitment.
  const firstBreachByCommitmentId = new Map<
    string,
    { caseId: string; caseOpenedAt: Date; breachedAt: Date }
  >();
  for (const row of breachEvaluations) {
    if (firstBreachByCommitmentId.has(row.commitmentId)) continue;
    firstBreachByCommitmentId.set(row.commitmentId, {
      caseId: row.commitment.caseId,
      caseOpenedAt: row.commitment.case.openedAt,
      breachedAt: row.evaluatedAt,
    });
  }
  const firstBreaches = [...firstBreachByCommitmentId.values()];

  const breachesOverTime = bucketBreachesByDay(
    firstBreaches.map((b) => b.breachedAt),
    periodStart,
    asOfDate,
  );

  const breachCaseIds = [...new Set(firstBreaches.map((b) => b.caseId))];
  const eventRows =
    breachCaseIds.length > 0
      ? await prisma.normalizedEvent.findMany({
          where: { caseId: { in: breachCaseIds } },
        })
      : [];

  const eventsByCaseId = new Map<string, ReturnType<typeof toNormalizedEventDomain>[]>();
  for (const row of eventRows) {
    const domainEvent = toNormalizedEventDomain(row);
    const existing = eventsByCaseId.get(row.caseId);
    if (existing) existing.push(domainEvent);
    else eventsByCaseId.set(row.caseId, [domainEvent]);
  }

  const legCounts = new Map<Leg, number>();
  for (const breach of firstBreaches) {
    const { spans } = deriveLegSpans(eventsByCaseId.get(breach.caseId) ?? [], {
      caseOpenedAt: breach.caseOpenedAt.toISOString(),
    });
    const leg = legAtTime(spans, breach.breachedAt.toISOString());
    legCounts.set(leg, (legCounts.get(leg) ?? 0) + 1);
  }

  const breachesByStage: BreachesByStageRow[] = [...legCounts.entries()]
    .map(([leg, count]) => ({ leg, count }))
    .sort((a, b) => b.count - a.count);

  return { compliance, breachesOverTime, breachesByStage };
}
