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
  /** RawEvent id of the current latest snapshot — the right `sourceRawEventId` for an event that reflects *this* observation (e.g. a re-link), as opposed to the original one. */
  latestRawEventId: string;
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
        latestRawEventId: row.id,
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
      existing.latestRawEventId = row.id;
      existing.link = link;
    }
  }
  return byKey;
}

export interface CorrelationResult {
  remoteLinksEvaluated: number;
  caseLinksCreated: number;
  /** A CaseLink that was `unlinkedAt`-marked (e.g. by `runZendeskJiraLinkCorrelation`'s unlink sweep) and became active again this run because a remote link still/again evidences it. Not counted in `caseLinksCreated`. */
  caseLinksReactivated: number;
  unmatchedNotZendeskUrl: number;
  unmatchedNoCase: number;
}

/**
 * A CaseLink's `evidence` as a small bag of merged fields rather than one
 * source's raw payload — `runJiraNormalization` (./normalize.ts) already
 * treats it this way, spreading the existing value and grafting on
 * `statusName`. This producer and its Zendesk-side counterpart
 * (`runZendeskJiraLinkCorrelation` in packages/zendesk/src/correlate.ts)
 * extend that same pattern: each nests its own raw evidence under its own
 * key instead of overwriting the whole field, so a CaseLink discovered by
 * both a remote link and an official link keeps both, never just whichever
 * producer ran last.
 */
interface CaseLinkEvidence {
  remoteLink?: JiraRemoteLink;
  officialLink?: unknown;
  [key: string]: unknown;
}

/**
 * Deterministic-tier correlator (Phase 15): reads Jira remote links already
 * ingested by the backfill/poll, and for each one pointing at a Zendesk
 * ticket on this organization's connected Zendesk subdomain, creates a
 * `certain`/`remote_link` CaseLink plus an `issue_linked` NormalizedEvent on
 * first sight. No fuzzy matching — a link that isn't a Zendesk URL on the
 * right subdomain, or whose ticket has no matching Case yet, is left
 * unlinked and counted, never guessed at. A stale Zendesk subdomain (an old
 * connection's hostname baked into the link) is rejected here exactly like
 * any other non-matching host — this hostname check is intentionally never
 * relaxed. Zendesk's own official Jira-links API
 * (`runZendeskJiraLinkCorrelation`, packages/zendesk/src/correlate.ts) is the
 * authoritative fallback for a relationship a stale remote link can no
 * longer prove.
 *
 * CaseLink identity is `(caseId, system, externalId)` (no `method` in the
 * unique key — see the `CaseLink` model), so when both this producer and
 * `runZendeskJiraLinkCorrelation` discover the same (case, issue)
 * relationship they upsert the very same row rather than minting two: each
 * merges onto the other's evidence (see `CaseLinkEvidence`), and
 * `official_link` always wins the `method` field once present — it's the
 * authoritative signal — regardless of which producer runs first.
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
    caseLinksReactivated: 0,
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

  for (const { issueKey, link, firstRawEventId, firstObservedAt, latestRawEventId, latestObservedAt } of latestLinks.values()) {
    const ticketId = parseZendeskTicketId(link.object.url, subdomain);
    if (!ticketId) {
      result.unmatchedNotZendeskUrl += 1;
      continue;
    }

    const zendeskCase = await prisma.case.findUnique({
      where: { organizationId_externalId: { organizationId, externalId: ticketId } },
    });
    if (!zendeskCase || zendeskCase.deletedAt) {
      result.unmatchedNoCase += 1;
      continue;
    }

    const where = { caseId_system_externalId: { caseId: zendeskCase.id, system: "jira" as const, externalId: issueKey } };
    const existing = await prisma.caseLink.findUnique({ where });
    // Merge onto whatever evidence is already there rather than overwrite —
    // see the `CaseLinkEvidence` doc comment above for why. `official_link`
    // always wins `method` when present, whether it was already recorded
    // here or `runZendeskJiraLinkCorrelation` gets to this same row first.
    const existingEvidence = (existing?.evidence as CaseLinkEvidence | null) ?? {};
    const evidence: CaseLinkEvidence = { ...existingEvidence, remoteLink: link };
    const method: "official_link" | "remote_link" = evidence.officialLink != null ? "official_link" : "remote_link";
    const wasUnlinked = existing != null && existing.unlinkedAt != null;

    // CaseLink upsert and its `issue_linked` event are written atomically so
    // the two can never land only one of them — a crash in between would
    // otherwise leave a CaseLink with no event, indistinguishable from one
    // this correlator just hasn't reached yet. Reaching this upsert at all
    // means a remote link currently resolves to this (case, issue) pair, so
    // `unlinkedAt` always clears here — including reactivating a row
    // `runZendeskJiraLinkCorrelation`'s unlink sweep had marked (the
    // official link disappeared with no remote link at the time; one has
    // since appeared).
    await prisma.$transaction([
      prisma.caseLink.upsert({
        where,
        update: { method, evidence: evidence as Prisma.InputJsonValue, unlinkedAt: null },
        create: {
          caseId: zendeskCase.id,
          system: "jira",
          externalId: issueKey,
          method,
          confidence: "certain",
          evidence: evidence as Prisma.InputJsonValue,
          confirmedAt: new Date(),
        },
      }),
      ...(!existing
        ? [
            prisma.normalizedEvent.create({
              data: {
                caseId: zendeskCase.id,
                sourceRawEventId: firstRawEventId,
                type: "issue_linked" as const,
                occurredAt: firstObservedAt,
                actor: "system" as const,
                system: "jira" as const,
                fromState: null,
                toState: null,
              },
            }),
          ]
        : wasUnlinked
          ? [
              // Re-link: a fresh `issue_linked` event at the moment this run
              // reconfirmed it, not the original link time.
              prisma.normalizedEvent.create({
                data: {
                  caseId: zendeskCase.id,
                  sourceRawEventId: latestRawEventId,
                  type: "issue_linked" as const,
                  occurredAt: latestObservedAt,
                  actor: "system" as const,
                  system: "jira" as const,
                  fromState: null,
                  toState: null,
                },
              }),
            ]
          : []),
    ]);

    if (!existing) {
      result.caseLinksCreated += 1;
    } else if (wasUnlinked) {
      result.caseLinksReactivated += 1;
    }
  }

  return result;
}
