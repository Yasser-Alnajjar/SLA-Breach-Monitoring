import type { PrismaClient } from "@sla/db";
import { detectCycleTimeAnomaly, type CommitmentKind } from "@sla/core";
import type { CycleTimeAnomalyRow } from "./types/dashboard";

// A single very slow or fast case shouldn't flip the call — this is how
// many of a customer/kind's most-recently-closed commitments count as
// "recent" for the comparison.
const RECENT_WINDOW_COUNT = 5;
// Dashboard callout is a NICE TO HAVE surface (roadmap step 25) — cap it
// like the other dashboard lists (AT_RISK_LIMIT, AGING_LIMIT) rather than
// growing unbounded as more customers accumulate anomalies.
const ANOMALY_LIMIT = 5;

interface CycleTimeSample {
  closedAt: Date;
  cycleTimeMinutes: number;
}

/**
 * Statistical (not AI/LLM — Phase 10's DO NOT BUILD list) anomaly detection
 * on cycle times, roadmap step 25: for each (customer, commitment kind)
 * with enough closed-commitment history, compares the last few cycle times
 * against everything before them via `detectCycleTimeAnomaly`'s median/MAD
 * check. "Cycle time" here is the terminal `Evaluation.elapsedWorkingMinutes`
 * for a commitment — the same working-minutes snapshot the pipeline
 * persisted at `evaluatedAt === commitment.closedAt` when it finalized the
 * commitment (`evaluate-pipeline.ts`), not a value recomputed here.
 */
export async function getCycleTimeAnomalies(
  prisma: PrismaClient,
  organizationId: string,
): Promise<CycleTimeAnomalyRow[]> {
  const closedCommitments = await prisma.commitment.findMany({
    where: {
      case: { organizationId, deletedAt: null, customerId: { not: null } },
      closedAt: { not: null },
      status: { in: ["met", "breached"] },
    },
    select: {
      id: true,
      kind: true,
      closedAt: true,
      case: { select: { customer: { select: { id: true, name: true } } } },
    },
  });

  if (closedCommitments.length === 0) return [];

  const evaluationRows = await prisma.evaluation.findMany({
    where: { commitmentId: { in: closedCommitments.map((c) => c.id) } },
    select: {
      commitmentId: true,
      evaluatedAt: true,
      elapsedWorkingMinutes: true,
    },
    orderBy: { evaluatedAt: "asc" },
  });

  const evaluationsByCommitmentId = new Map<string, typeof evaluationRows>();
  for (const row of evaluationRows) {
    const existing = evaluationsByCommitmentId.get(row.commitmentId);
    if (existing) existing.push(row);
    else evaluationsByCommitmentId.set(row.commitmentId, [row]);
  }

  const samplesByGroup = new Map<
    string,
    { customerName: string; kind: CommitmentKind; samples: CycleTimeSample[] }
  >();

  for (const commitment of closedCommitments) {
    const customer = commitment.case.customer;
    const closedAt = commitment.closedAt;
    if (!customer || !closedAt) continue;

    const evaluations = evaluationsByCommitmentId.get(commitment.id) ?? [];
    const terminal = evaluations
      .filter((e) => e.evaluatedAt.getTime() <= closedAt.getTime())
      .at(-1);
    if (!terminal) continue;

    const groupKey = `${customer.id}:${commitment.kind}`;
    const sample: CycleTimeSample = {
      closedAt,
      cycleTimeMinutes: terminal.elapsedWorkingMinutes,
    };
    const group = samplesByGroup.get(groupKey);
    if (group) group.samples.push(sample);
    else
      samplesByGroup.set(groupKey, {
        customerName: customer.name,
        kind: commitment.kind,
        samples: [sample],
      });
  }

  const anomalies: CycleTimeAnomalyRow[] = [];
  for (const group of samplesByGroup.values()) {
    const sorted = [...group.samples].sort(
      (a, b) => a.closedAt.getTime() - b.closedAt.getTime(),
    );
    const recent = sorted.slice(-RECENT_WINDOW_COUNT);
    const baseline = sorted.slice(0, -RECENT_WINDOW_COUNT);

    const anomaly = detectCycleTimeAnomaly(
      baseline.map((s) => s.cycleTimeMinutes),
      recent.map((s) => s.cycleTimeMinutes),
    );
    if (!anomaly) continue;

    anomalies.push({
      customerName: group.customerName,
      kind: group.kind,
      ...anomaly,
    });
  }

  anomalies.sort(
    (a, b) => Math.abs(b.modifiedZScore) - Math.abs(a.modifiedZScore),
  );
  return anomalies.slice(0, ANOMALY_LIMIT);
}
