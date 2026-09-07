import type { PrismaClient } from "@sla/db";
import {
  evaluateCommitment,
  type BusinessCalendarVersion,
  type CommitmentKind,
  type CommitmentStatus,
  type NormalizedState,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";
import { toCommitmentDomain, toNormalizedEventDomain } from "@sla/commitments";
import type { ZendeskCredentials } from "@sla/zendesk";
import type { JiraCredentials } from "@sla/jira";
import { buildCsv } from "./csv";
import { formatCommitmentKind, formatCommitmentStatus, formatMinutes } from "./format";

export interface ComplianceReportRow {
  customerName: string;
  externalId: string;
  zendeskUrl: string | null;
  jiraIssueKeys: string[];
  linearIssueKeys: string[];
  kind: CommitmentKind;
  status: CommitmentStatus;
  targetMinutes: number;
  elapsedWorkingMinutes: number | null;
  breachedByMinutes: number | null;
  openedAt: string;
  dueAt: string;
  closedAt: string | null;
}

/**
 * Every commitment in the organization — open and closed — for the CSV
 * export (the reporting floor, Phase 10). Closed commitments read their
 * elapsed/status from the last persisted `Evaluation` (the final snapshot
 * the worker recorded when the case closed) rather than re-running the
 * engine, since that snapshot *is* what actually happened; open ones are
 * evaluated live, same as the dashboard, so an export taken mid-cycle isn't
 * stale.
 */
export async function getComplianceReportRows(
  prisma: PrismaClient,
  organizationId: string,
  asOfDate: Date = new Date(),
): Promise<ComplianceReportRow[]> {
  const asOf = asOfDate.toISOString();

  const [commitmentRows, zendeskIntegration, jiraIntegration] = await Promise.all([
    prisma.commitment.findMany({
      where: { case: { organizationId } },
      include: { case: { include: { customer: true, caseLinks: true } } },
    }),
    prisma.integration.findUnique({ where: { organizationId_provider: { organizationId, provider: "zendesk" } } }),
    prisma.integration.findUnique({ where: { organizationId_provider: { organizationId, provider: "jira" } } }),
  ]);

  const zendeskCredentials = (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;
  const jiraCredentials = (jiraIntegration?.credentials as JiraCredentials | null) ?? null;

  const openCommitmentRows = commitmentRows.filter((c) => c.closedAt === null);
  const closedCommitmentRows = commitmentRows.filter((c) => c.closedAt !== null);

  const policyVersionIds = [...new Set(openCommitmentRows.map((c) => c.policyVersionId))];
  const calendarVersionIds = [...new Set(openCommitmentRows.map((c) => c.calendarVersionId))];
  const caseIds = [...new Set(openCommitmentRows.map((c) => c.caseId))];

  const [policyVersionRows, calendarVersionRows, eventRows, latestEvaluationRows] = await Promise.all([
    policyVersionIds.length > 0
      ? prisma.sLAPolicyVersion.findMany({ where: { id: { in: policyVersionIds } } })
      : Promise.resolve([]),
    calendarVersionIds.length > 0
      ? prisma.businessCalendarVersion.findMany({ where: { id: { in: calendarVersionIds } } })
      : Promise.resolve([]),
    caseIds.length > 0 ? prisma.normalizedEvent.findMany({ where: { caseId: { in: caseIds } } }) : Promise.resolve([]),
    closedCommitmentRows.length > 0
      ? prisma.evaluation.findMany({
          where: { commitmentId: { in: closedCommitmentRows.map((c) => c.id) } },
          orderBy: { evaluatedAt: "desc" },
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

  const eventsByCaseId = new Map<string, ReturnType<typeof toNormalizedEventDomain>[]>();
  for (const row of eventRows) {
    const domainEvent = toNormalizedEventDomain(row);
    const existing = eventsByCaseId.get(row.caseId);
    if (existing) existing.push(domainEvent);
    else eventsByCaseId.set(row.caseId, [domainEvent]);
  }

  // First (i.e. latest, since sorted desc) evaluation per commitment.
  const latestEvaluationByCommitmentId = new Map<string, (typeof latestEvaluationRows)[number]>();
  for (const evaluation of latestEvaluationRows) {
    if (!latestEvaluationByCommitmentId.has(evaluation.commitmentId)) {
      latestEvaluationByCommitmentId.set(evaluation.commitmentId, evaluation);
    }
  }

  function toRow(row: (typeof commitmentRows)[number]): ComplianceReportRow {
    const jiraIssueKeys = row.case.caseLinks.filter((l) => l.system === "jira").map((l) => l.externalId);
    const linearIssueKeys = row.case.caseLinks.filter((l) => l.system === "linear").map((l) => l.externalId);
    const zendeskUrl = zendeskCredentials
      ? `https://${zendeskCredentials.subdomain}.zendesk.com/agent/tickets/${row.case.externalId}`
      : null;

    const base = {
      customerName: row.case.customer?.name ?? "Unknown account",
      externalId: row.case.externalId,
      zendeskUrl,
      jiraIssueKeys,
      linearIssueKeys,
      kind: row.kind,
      targetMinutes: row.targetMinutes,
      openedAt: row.case.openedAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    };

    if (row.closedAt) {
      const evaluation = latestEvaluationByCommitmentId.get(row.id);
      return {
        ...base,
        status: evaluation?.status ?? row.status,
        elapsedWorkingMinutes: evaluation?.elapsedWorkingMinutes ?? null,
        breachedByMinutes: evaluation?.breachedByMinutes ?? null,
      };
    }

    const policyVersion = policyVersionsById.get(row.policyVersionId);
    const calendar = calendarsById.get(row.calendarVersionId);
    if (!policyVersion || !calendar) {
      return { ...base, status: row.status, elapsedWorkingMinutes: null, breachedByMinutes: null };
    }
    const events = eventsByCaseId.get(row.caseId) ?? [];
    const evaluation = evaluateCommitment(toCommitmentDomain(row), events, policyVersion, calendar, asOf);
    return {
      ...base,
      status: evaluation.status,
      elapsedWorkingMinutes: evaluation.elapsedWorkingMinutes,
      breachedByMinutes: evaluation.breachedByMinutes ?? null,
    };
  }

  return commitmentRows
    .map(toRow)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

const CSV_HEADER = [
  "Customer",
  "Ticket",
  "Zendesk URL",
  "Jira issues",
  "Linear issues",
  "Commitment",
  "Status",
  "Target",
  "Elapsed",
  "Breached by",
  "Opened at",
  "Due at",
  "Closed at",
];

export function complianceReportToCsv(rows: ComplianceReportRow[]): string {
  return buildCsv(
    CSV_HEADER,
    rows.map((row) => [
      row.customerName,
      row.externalId,
      row.zendeskUrl,
      row.jiraIssueKeys.join(" "),
      row.linearIssueKeys.join(" "),
      formatCommitmentKind(row.kind),
      formatCommitmentStatus(row.status),
      formatMinutes(row.targetMinutes),
      row.elapsedWorkingMinutes !== null ? formatMinutes(row.elapsedWorkingMinutes) : "",
      row.breachedByMinutes !== null ? formatMinutes(row.breachedByMinutes) : "",
      row.openedAt,
      row.dueAt,
      row.closedAt,
    ]),
  );
}
