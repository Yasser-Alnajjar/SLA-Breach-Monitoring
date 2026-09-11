import "server-only";
import type { PrismaClient } from "@sla/db";
import type { CommitmentStatus } from "@sla/core";
import type { CaseListData, CaseListRow } from "./types/cases";

// Precedence for picking one representative status out of a case's several
// commitments — worst-first, so a single breached commitment surfaces even
// if another commitment on the same case has already been met.
const STATUS_PRECEDENCE: CommitmentStatus[] = ["breached", "at_risk", "on_track", "met", "cancelled"];

function worstStatus(statuses: CommitmentStatus[]): CommitmentStatus | null {
  if (statuses.length === 0) return null;
  return STATUS_PRECEDENCE.find((status) => statuses.includes(status)) ?? statuses[0] ?? null;
}

/**
 * All cases for the organization, open or closed, with every commitment
 * status — no filtering by `Case.closedAt` or `Commitment.status`. Unlike
 * `getDashboardData`, this doesn't re-evaluate commitments live; it only
 * needs the persisted status to pick a worst-of badge per case.
 */
export async function getCaseListData(prisma: PrismaClient, organizationId: string): Promise<CaseListData> {
  const rows = await prisma.case.findMany({
    where: { organizationId },
    include: { customer: true, commitments: { select: { status: true } } },
    orderBy: { openedAt: "desc" },
  });

  const cases: CaseListRow[] = rows.map((row) => ({
    caseId: row.id,
    externalId: row.externalId,
    subject: row.subject,
    customerName: row.customer?.name ?? null,
    priority: row.priority,
    tier: row.tier,
    channel: row.channel,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    worstCommitmentStatus: worstStatus(row.commitments.map((c) => c.status)),
  }));

  return { asOf: new Date().toISOString(), cases };
}
