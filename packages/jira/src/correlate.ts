import type { Prisma, PrismaClient } from "@sla/db";
import type { JiraRemoteLink } from "./types";

/**
 * Extracts a Zendesk ticket id from a URL, but only when the host is exactly
 * `{subdomain}.zendesk.com` — a link to some other tenant's Zendesk (or a
 * lookalike domain) must never correlate, per Phase 15's deterministic-tier
 * rule: never confidently invent a relationship.
 */
export function parseZendeskTicketId(url: string, subdomain: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== `${subdomain.toLowerCase()}.zendesk.com`) return null;

  const match = parsed.pathname.match(/\/(?:agent\/tickets|requests|api\/v2\/tickets)\/(\d+)(?:\.json)?\/?$/);
  return match ? match[1]! : null;
}

interface LatestRemoteLink {
  link: JiraRemoteLink;
  latestObservedAt: Date;
  /** Earliest time this link was ever observed — the best available proxy for when it was created, since Jira's remote-link API carries no creation timestamp. */
  firstObservedAt: Date;
  firstRawEventId: string;
}

/** `remote_link:{issueKey}:{linkId}:{hash}` — groups by (issueKey, linkId), keeping the latest snapshot and the earliest-ever observation. */
function latestRemoteLinksByKey(
  rows: { id: string; providerEventId: string; payload: unknown; fetchedAt: Date }[],
): Map<string, { issueKey: string } & LatestRemoteLink> {
  const byKey = new Map<string, { issueKey: string } & LatestRemoteLink>();
  for (const row of rows) {
    const parts = row.providerEventId.split(":");
    const issueKey = parts[1];
    const linkId = parts[2];
    if (!issueKey || !linkId) continue;
    const key = `${issueKey}:${linkId}`;
    const link = row.payload as JiraRemoteLink;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        issueKey,
        link,
        latestObservedAt: row.fetchedAt,
        firstRawEventId: row.id,
        firstObservedAt: row.fetchedAt,
      });
      continue;
    }

    if (row.fetchedAt < existing.firstObservedAt) {
      existing.firstObservedAt = row.fetchedAt;
      existing.firstRawEventId = row.id;
    }
    if (row.fetchedAt >= existing.latestObservedAt) {
      existing.latestObservedAt = row.fetchedAt;
      existing.link = link;
    }
  }
  return byKey;
}

export interface CorrelationResult {
  remoteLinksEvaluated: number;
  caseLinksCreated: number;
  unmatchedNotZendeskUrl: number;
  unmatchedNoCase: number;
}

/**
 * Deterministic-tier correlator (Phase 15): reads Jira remote links already
 * ingested by the backfill/poll, and for each one pointing at a Zendesk
 * ticket on this organization's connected Zendesk subdomain, creates a
 * `certain`/`remote_link` CaseLink plus an `issue_linked` NormalizedEvent on
 * first sight. No fuzzy matching — a link that isn't a Zendesk URL on the
 * right subdomain, or whose ticket has no matching Case yet, is left
 * unlinked and counted, never guessed at.
 *
 * Must run before `runJiraNormalization`, which relies on the CaseLinks
 * created here to know which Case a Jira issue's events belong to.
 */
export async function runJiraCorrelation(prisma: PrismaClient, integrationId: string): Promise<CorrelationResult> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const organizationId = integration.organizationId;

  const result: CorrelationResult = {
    remoteLinksEvaluated: 0,
    caseLinksCreated: 0,
    unmatchedNotZendeskUrl: 0,
    unmatchedNoCase: 0,
  };

  const zendeskIntegration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "zendesk" } },
  });
  const subdomain = (zendeskIntegration?.credentials as { subdomain?: string } | null)?.subdomain;
  if (!subdomain) return result;

  const remoteLinkRows = await prisma.rawEvent.findMany({
    where: { integrationId, providerEventId: { startsWith: "remote_link:" } },
    select: { id: true, providerEventId: true, payload: true, fetchedAt: true },
  });

  const latestLinks = latestRemoteLinksByKey(remoteLinkRows);
  result.remoteLinksEvaluated = latestLinks.size;

  for (const { issueKey, link, firstRawEventId, firstObservedAt } of latestLinks.values()) {
    const ticketId = parseZendeskTicketId(link.object.url, subdomain);
    if (!ticketId) {
      result.unmatchedNotZendeskUrl += 1;
      continue;
    }

    const zendeskCase = await prisma.case.findUnique({
      where: { organizationId_externalId: { organizationId, externalId: ticketId } },
    });
    if (!zendeskCase) {
      result.unmatchedNoCase += 1;
      continue;
    }

    const where = { caseId_system_externalId: { caseId: zendeskCase.id, system: "jira" as const, externalId: issueKey } };
    const existing = await prisma.caseLink.findUnique({ where });

    await prisma.caseLink.upsert({
      where,
      update: { evidence: link as unknown as Prisma.InputJsonValue },
      create: {
        caseId: zendeskCase.id,
        system: "jira",
        externalId: issueKey,
        method: "remote_link",
        confidence: "certain",
        evidence: link as unknown as Prisma.InputJsonValue,
        confirmedAt: new Date(),
      },
    });

    if (!existing) {
      result.caseLinksCreated += 1;
      await prisma.normalizedEvent.create({
        data: {
          caseId: zendeskCase.id,
          sourceRawEventId: firstRawEventId,
          type: "issue_linked",
          occurredAt: firstObservedAt,
          actor: "system",
          system: "jira",
          fromState: null,
          toState: null,
        },
      });
    }
  }

  return result;
}
