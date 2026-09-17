import type { PrismaClient } from "@sla/db";
import {
  computeElapsedWorkingMinutes,
  deriveLegSpans,
  evaluateCommitment,
  evaluateEngineeringLegTarget,
  sumLegMinutes,
  type BusinessCalendarVersion,
  type CommitmentKind,
  type EngineeringLegEvaluation,
  type Leg,
  type NormalizedEvent,
  type NormalizedState,
  type PausedInterval,
  type SLAPolicyMatch,
  type SLAPolicyVersion,
  type WeeklyWindow,
} from "@sla/core";
import { toCommitmentDomain, toNormalizedEventDomain } from "@sla/commitments";
import type { ZendeskCredentials } from "@sla/zendesk";
import { buildIntercomConversationUrl, type IntercomCredentials } from "@sla/intercom";
import type { JiraCredentials } from "@sla/jira";
import type {
  CaseDetailData,
  CaseLinkDetail,
  CommitmentDetail,
  LegTotal,
  TimelineEventDetail,
} from "./types/cases";

// No business calendar exists yet for a case whose SLA hasn't matched any
// policy — fall back to an always-open calendar purely for the purpose of
// rendering the working/paused overlay (which does not actually depend on
// working-hours math, only on the pause-state event stream).
const FALLBACK_CALENDAR: BusinessCalendarVersion = {
  id: "none",
  version: 0,
  timezone: "UTC",
  weekly: [],
  holidays: [],
  alwaysOpen: true,
};

function complementIntervals(
  pausedIntervals: PausedInterval[],
  start: string,
  end: string,
): { start: string; end: string }[] {
  const sorted = [...pausedIntervals].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const running: { start: string; end: string }[] = [];
  let cursor = start;
  for (const p of sorted) {
    if (p.start > cursor) running.push({ start: cursor, end: p.start });
    if (p.end > cursor) cursor = p.end;
  }
  if (end > cursor) running.push({ start: cursor, end });
  return running;
}

/**
 * Assembles everything the case detail page (roadmap step 10) needs: the
 * header, both commitments with the policy/calendar that produced their
 * numbers (the "how this was calculated" disclosure), the leg timeline with
 * working/paused shading, and outbound links to both source systems.
 *
 * Returns null when the case doesn't exist or belongs to a different
 * organization — the caller renders a 404 either way, so no distinction is
 * made between the two.
 */
export async function getCaseDetailData(
  prisma: PrismaClient,
  organizationId: string,
  caseId: string,
  asOfDate: Date = new Date(),
): Promise<CaseDetailData | null> {
  const asOf = asOfDate.toISOString();

  const caseRow = await prisma.case.findFirst({
    where: { id: caseId, organizationId, deletedAt: null },
    include: { customer: true, caseLinks: true, commitments: true },
  });
  if (!caseRow) return null;

  const [eventRows, zendeskIntegration, jiraIntegration, intercomIntegration, organization] =
    await Promise.all([
      prisma.normalizedEvent.findMany({
        where: { caseId },
        orderBy: { occurredAt: "asc" },
      }),
      prisma.integration.findUnique({
        where: {
          organizationId_provider: { organizationId, provider: "zendesk" },
        },
      }),
      prisma.integration.findUnique({
        where: {
          organizationId_provider: { organizationId, provider: "jira" },
        },
      }),
      prisma.integration.findUnique({
        where: {
          organizationId_provider: { organizationId, provider: "intercom" },
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { engineeringLegTargetMinutes: true },
      }),
    ]);

  const policyVersionIds = [
    ...new Set(caseRow.commitments.map((c) => c.policyVersionId)),
  ];
  const calendarVersionIds = [
    ...new Set(caseRow.commitments.map((c) => c.calendarVersionId)),
  ];

  const [policyVersionRows, calendarVersionRows] = await Promise.all([
    policyVersionIds.length > 0
      ? prisma.sLAPolicyVersion.findMany({
          where: { id: { in: policyVersionIds } },
        })
      : Promise.resolve([]),
    calendarVersionIds.length > 0
      ? prisma.businessCalendarVersion.findMany({
          where: { id: { in: calendarVersionIds } },
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

  const domainEvents: NormalizedEvent[] = eventRows.map(
    toNormalizedEventDomain,
  );

  const commitments: CommitmentDetail[] = caseRow.commitments
    .map((row): CommitmentDetail | null => {
      const policyVersion = policyVersionsById.get(row.policyVersionId);
      const calendarRow = calendarVersionRows.find(
        (c) => c.id === row.calendarVersionId,
      );
      const calendar = calendarsById.get(row.calendarVersionId);
      if (!policyVersion || !calendarRow || !calendar) return null;

      const evaluation = evaluateCommitment(
        toCommitmentDomain(row),
        domainEvents,
        policyVersion,
        calendar,
        asOf,
      );

      return {
        id: row.id,
        kind: row.kind,
        status: evaluation.status,
        startedAt: row.startedAt.toISOString(),
        targetMinutes: row.targetMinutes,
        closedAt: row.closedAt?.toISOString() ?? null,
        elapsedSeconds: evaluation.elapsedSeconds,
        remainingSeconds: evaluation.remainingSeconds,
        breachedBySeconds: evaluation.breachedBySeconds ?? null,
        clockState: evaluation.clock.state,
        pausedSince: evaluation.clock.pausedSince,
        effectiveDueAt: evaluation.effectiveDueAt,
        policyVersion: {
          id: policyVersion.id,
          version: policyVersion.version,
          match: policyVersion.match,
          warnAtPercent: policyVersion.warnAtPercent,
          pauseOnStates: policyVersion.pauseOnStates,
          effectiveFrom: policyVersion.effectiveFrom,
        },
        calendar: {
          id: calendar.id,
          version: calendarRow.version,
          timezone: calendar.timezone,
          weekly: calendar.weekly,
          holidays: calendar.holidays,
          alwaysOpen: calendar.alwaysOpen,
        },
      };
    })
    .filter((c): c is CommitmentDetail => c !== null)
    .sort((a, b) => (a.kind === "first_response" ? -1 : 1));

  const endBound = caseRow.closedAt?.toISOString() ?? asOf;

  const { spans } = deriveLegSpans(domainEvents, {
    caseOpenedAt: caseRow.openedAt.toISOString(),
  });
  const legSpans = spans.map((s) => ({ ...s, endedAt: s.endedAt ?? endBound }));
  const currentLeg: Leg = legSpans[legSpans.length - 1]?.leg ?? "unknown";

  const legTotalsByLeg = new Map<Leg, number>();
  for (const s of legSpans) {
    const minutes =
      (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) /
      60_000;
    legTotalsByLeg.set(s.leg, (legTotalsByLeg.get(s.leg) ?? 0) + minutes);
  }
  const LEG_ORDER: Leg[] = [
    "support",
    "engineering",
    "waiting_customer",
    "unknown",
  ];
  const legTotals: LegTotal[] = LEG_ORDER.filter((leg) =>
    legTotalsByLeg.has(leg),
  ).map((leg) => ({
    leg,
    minutes: legTotalsByLeg.get(leg)!,
  }));

  const engineeringLegTargetMinutes =
    organization?.engineeringLegTargetMinutes ?? null;
  const engineeringLegTarget: EngineeringLegEvaluation | null =
    engineeringLegTargetMinutes !== null
      ? evaluateEngineeringLegTarget(
          sumLegMinutes(spans, "engineering", endBound),
          engineeringLegTargetMinutes,
          currentLeg === "engineering",
        )
      : null;

  const pauseOnStates = commitments[0]?.policyVersion.pauseOnStates ?? [];
  const pauseCalendar = commitments[0]
    ? calendarsById.get(commitments[0].calendar.id)!
    : FALLBACK_CALENDAR;
  const { pausedIntervals } = computeElapsedWorkingMinutes(
    domainEvents,
    pauseOnStates,
    pauseCalendar,
    endBound,
  );
  const runningIntervals = complementIntervals(
    pausedIntervals,
    caseRow.openedAt.toISOString(),
    endBound,
  );

  const zendeskCredentials =
    (zendeskIntegration?.credentials as ZendeskCredentials | null) ?? null;
  const jiraCredentials =
    (jiraIntegration?.credentials as JiraCredentials | null) ?? null;

  const intercomWorkspaceId =
    (intercomIntegration?.credentials as IntercomCredentials | null)?.workspaceId ?? null;

  // Gated on caseRow.system (roadmap step 22), not just "is Zendesk
  // connected": an org with both ticket sources connected would otherwise
  // build a Zendesk ticket link for an Intercom-sourced case whose externalId
  // was never a Zendesk ticket id, or vice versa. Intercom's link needs the
  // workspace id the backfill records from `GET /me` — null until the first
  // sync after connecting.
  const ticketUrl =
    caseRow.system === "zendesk" && zendeskCredentials
      ? `https://${zendeskCredentials.subdomain}.zendesk.com/agent/tickets/${caseRow.externalId}`
      : caseRow.system === "intercom" && intercomWorkspaceId
        ? buildIntercomConversationUrl(intercomWorkspaceId, caseRow.externalId)
        : null;

  // Every CaseLink system this page knows how to render — a Zendesk CaseLink
  // never actually occurs (Case itself *is* the Zendesk side), but the type
  // guard stays honest about the full IntegrationProvider union.
  const links: CaseLinkDetail[] = caseRow.caseLinks
    .filter(
      (link): link is typeof link & { system: "jira" | "zendesk" | "linear" | "github" } =>
        link.system === "jira" ||
        link.system === "zendesk" ||
        link.system === "linear" ||
        link.system === "github",
    )
    .map((link) => ({
      system: link.system,
      externalId: link.externalId,
      method: link.method,
      confidence: link.confidence,
      url:
        link.system === "jira" && jiraCredentials
          ? `${jiraCredentials.siteUrl.replace(/\/$/, "")}/browse/${link.externalId}`
          : link.system === "zendesk" && zendeskCredentials
            ? `https://${zendeskCredentials.subdomain}.zendesk.com/agent/tickets/${link.externalId}`
            : link.system === "linear"
              ? // Linear's stored OAuth credentials carry no workspace URL to
                // reconstruct a browse link from (unlike Jira's `siteUrl` or
                // Zendesk's `subdomain`), so the correlator (roadmap step 15)
                // captures the issue's own `url` into evidence at link time.
                ((link.evidence as { issueUrl?: string } | null)?.issueUrl ??
                null)
              : link.system === "github"
                ? // Unlike Linear, a GitHub CaseLink's externalId itself
                  // (`owner/repo#number`) is enough to build the PR URL —
                  // no credential lookup or evidence capture needed.
                  `https://github.com/${link.externalId.replace("#", "/pull/")}`
                : null,
      // Jira's live status name (e.g. "In Progress") is stashed into
      // evidence by runJiraNormalization on every run — the timeline itself
      // only carries the coarse new/in_progress/resolved category.
      statusName:
        (link.evidence as { statusName?: string } | null)?.statusName ?? null,
    }));

  const timeline: TimelineEventDetail[] = domainEvents.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt,
    actor: e.actor,
    system: e.system,
    type: e.type,
    fromState: e.fromState,
    toState: e.toState,
  }));

  return {
    asOf,
    case: {
      id: caseRow.id,
      externalId: caseRow.externalId,
      subject: caseRow.subject,
      priority: caseRow.priority,
      tier: caseRow.tier,
      channel: caseRow.channel,
      openedAt: caseRow.openedAt.toISOString(),
      closedAt: caseRow.closedAt?.toISOString() ?? null,
      customerName: caseRow.customer?.name ?? null,
      system: caseRow.system,
      ticketUrl,
    },
    currentLeg,
    commitments,
    legSpans,
    legTotals,
    engineeringLegTarget,
    runningIntervals,
    pausedIntervals,
    timeline,
    links,
  };
}
