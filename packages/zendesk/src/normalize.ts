import type { Prisma, PrismaClient } from "@sla/db";
import type { Actor, NormalizedEventType, NormalizedState } from "@sla/core";
import type { ZendeskAudit, ZendeskOrganization, ZendeskTicket } from "./types";

/** Zendesk's closed set of ticket statuses, mapped to the provider-independent vocabulary. */
const STATUS_TO_NORMALIZED_STATE: Record<string, NormalizedState> = {
  new: "new",
  open: "open",
  pending: "pending_customer",
  hold: "pending_internal",
  solved: "resolved",
  closed: "closed",
};

export class UnknownZendeskStatusError extends Error {
  constructor(status: string) {
    super(`Unknown Zendesk ticket status: ${status}`);
    this.name = "UnknownZendeskStatusError";
  }
}

export function normalizeZendeskStatus(status: string): NormalizedState {
  const mapped = STATUS_TO_NORMALIZED_STATE[status];
  if (!mapped) throw new UnknownZendeskStatusError(status);
  return mapped;
}

/** Channels Zendesk uses when a trigger/automation/rule made the change, not a person. */
const SYSTEM_CHANNELS = new Set(["trigger", "automation", "rule"]);

/**
 * Best-effort actor resolution without a Users export (out of scope for this
 * step): a system channel wins outright; otherwise compare the actor to the
 * ticket's requester, defaulting to "agent" since most audit activity is
 * agent-side and requester_id may be unknown for older/minimal payloads.
 */
export function resolveActor(channel: string | undefined, authorId: number, ticket: ZendeskTicket): Actor {
  if (channel && SYSTEM_CHANNELS.has(channel)) return "system";
  if (ticket.requester_id != null && authorId === ticket.requester_id) return "customer";
  return "agent";
}

function isStatusChangeEvent(
  event: ZendeskAudit["events"][number],
): event is { id: number; type: "Change"; field_name: "status"; value: string; previous_value: string } {
  return (
    event.type === "Change" &&
    event.field_name === "status" &&
    typeof event.value === "string" &&
    typeof event.previous_value === "string"
  );
}

function isPublicCommentEvent(
  event: ZendeskAudit["events"][number],
): event is { id: number; type: "Comment"; public: true; author_id?: number } {
  return event.type === "Comment" && event.public === true;
}

export interface AuditRecord {
  /** The RawEvent row id this audit was read from — becomes NormalizedEvent.sourceRawEventId. */
  rawEventId: string;
  audit: ZendeskAudit;
}

export interface DerivedNormalizedEvent {
  type: NormalizedEventType;
  occurredAt: string;
  actor: Actor;
  fromState: NormalizedState | null;
  toState: NormalizedState | null;
  sourceRawEventId: string;
}

export function sortAuditsChronologically(audits: AuditRecord[]): AuditRecord[] {
  return [...audits].sort((a, b) => {
    const byTime = Date.parse(a.audit.created_at) - Date.parse(b.audit.created_at);
    return byTime !== 0 ? byTime : a.audit.id - b.audit.id;
  });
}

/**
 * `RawEvent` → `NormalizedEvent` for one ticket. Regenerated from scratch on
 * every run (never diffed incrementally) — callers should replace, not
 * append to, a case's existing NormalizedEvents with this output.
 *
 * Status `Change` events carry Zendesk's own before/after values, so the
 * ticket's initial state comes from the first Change event's
 * `previous_value` (falling back to the ticket's current status when no
 * status change was ever recorded) rather than from re-deriving it by
 * replaying transitions ourselves.
 *
 * Public agent comments become `agent_replied` events — what completes a
 * first-response commitment. Comments on the ticket's creation audit (the
 * ticket's own description, even when an agent opened it) never count, and
 * neither do replies on a ticket whose requester is unknown, since
 * `resolveActor` could not tell the customer's comments from an agent's.
 */
export function deriveNormalizedEventsForTicket(
  ticket: ZendeskTicket,
  auditsForTicket: AuditRecord[],
  ticketRawEventId: string,
): DerivedNormalizedEvent[] {
  const sorted = sortAuditsChronologically(auditsForTicket);
  const statusChanges = sorted.flatMap(({ rawEventId, audit }) =>
    audit.events.filter(isStatusChangeEvent).map((event) => ({ rawEventId, audit, event })),
  );

  const firstChange = statusChanges[0];
  const initialStatus = firstChange ? firstChange.event.previous_value : ticket.status;
  const createdActor = firstChange
    ? resolveActor(firstChange.audit.via?.channel, firstChange.audit.author_id, ticket)
    : resolveActor(ticket.via?.channel, ticket.requester_id ?? -1, ticket);

  const events: DerivedNormalizedEvent[] = [
    {
      type: "case_created",
      occurredAt: ticket.created_at,
      actor: createdActor,
      fromState: null,
      toState: normalizeZendeskStatus(initialStatus),
      sourceRawEventId: firstChange?.rawEventId ?? ticketRawEventId,
    },
  ];

  for (const { rawEventId, audit, event } of statusChanges) {
    const toState = normalizeZendeskStatus(event.value);
    events.push({
      // "solved" and "closed" both end the case's customer-facing lifecycle
      // (Zendesk is the source of truth for that — Jira reaching its own
      // "done" category must never produce this type, see jira/normalize.ts).
      // "solved" can still be reopened by a later transition back to a
      // non-terminal state, which is emitted as a plain state_changed below.
      type: toState === "closed" || toState === "resolved" ? "case_closed" : "state_changed",
      occurredAt: audit.created_at,
      actor: resolveActor(audit.via?.channel, audit.author_id, ticket),
      fromState: normalizeZendeskStatus(event.previous_value),
      toState,
      sourceRawEventId: rawEventId,
    });
  }

  if (ticket.requester_id != null) {
    const createdAtMs = Date.parse(ticket.created_at);
    for (const { rawEventId, audit } of sorted) {
      if (Date.parse(audit.created_at) <= createdAtMs) continue;
      for (const event of audit.events.filter(isPublicCommentEvent)) {
        const actor = resolveActor(audit.via?.channel, event.author_id ?? audit.author_id, ticket);
        if (actor !== "agent") continue;
        events.push({
          type: "agent_replied",
          occurredAt: audit.created_at,
          actor,
          fromState: null,
          toState: null,
          sourceRawEventId: rawEventId,
        });
      }
    }
  }

  // Stable, so a status change and a reply at the same instant keep the
  // status change first.
  return events.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

/**
 * `Case.closedAt` for a ticket: set once it reaches a terminal Zendesk state
 * ("solved" or "closed"), timestamped from the most recent transition into
 * either — not the first, so a solve-then-reopen-then-resolve cycle reports
 * the final resolution, not the first one. Null whenever the ticket's
 * *current* status isn't terminal, including a solved ticket Zendesk later
 * reopened: `ticket.status` is always the live snapshot, so this naturally
 * flips back without needing to detect the reopen explicitly.
 *
 * Falls back to `ticket.updated_at` when no case_closed event was derived at
 * all — a ticket fetched for the first time already solved/closed, with no
 * audit history recorded for the transition.
 */
export function deriveCaseClosedAt(
  ticket: ZendeskTicket,
  derivedEvents: DerivedNormalizedEvent[],
): Date | null {
  const currentState = normalizeZendeskStatus(ticket.status);
  if (currentState !== "resolved" && currentState !== "closed") return null;

  const closureEvent = [...derivedEvents].reverse().find((event) => event.type === "case_closed");
  return new Date(closureEvent?.occurredAt ?? ticket.updated_at);
}

export interface NormalizationResult {
  customersUpserted: number;
  casesUpserted: number;
  normalizedEventsWritten: number;
  ticketsFailed: { ticketId: number; error: string }[];
}

/**
 * Keeps, per numeric `id` embedded in each row's JSON payload, the row with
 * the latest fetchedAt. `rawEventIds` lists every snapshot row seen for that
 * id (not just the latest), so a regenerate-in-place delete can also clear
 * events an older snapshot sourced.
 */
export function latestSnapshotById<T extends { id: number }>(
  rows: { id: string; payload: unknown; fetchedAt: Date }[],
): Map<number, { rawEventId: string; value: T; fetchedAt: Date; rawEventIds: string[] }> {
  const byId = new Map<number, { rawEventId: string; value: T; fetchedAt: Date; rawEventIds: string[] }>();
  for (const row of rows) {
    const value = row.payload as T;
    const existing = byId.get(value.id);
    const rawEventIds = [...(existing?.rawEventIds ?? []), row.id];
    if (!existing || row.fetchedAt >= existing.fetchedAt) {
      byId.set(value.id, { rawEventId: row.id, value, fetchedAt: row.fetchedAt, rawEventIds });
    } else {
      existing.rawEventIds = rawEventIds;
    }
  }
  return byId;
}

function groupAuditsByTicketId(
  rows: { id: string; payload: unknown }[],
): Map<number, AuditRecord[]> {
  const byTicketId = new Map<number, AuditRecord[]>();
  for (const row of rows) {
    const audit = row.payload as ZendeskAudit;
    const group = byTicketId.get(audit.ticket_id);
    const record: AuditRecord = { rawEventId: row.id, audit };
    if (group) group.push(record);
    else byTicketId.set(audit.ticket_id, [record]);
  }
  return byTicketId;
}

/**
 * Projects everything ingested so far for one integration into
 * Customer/Case/NormalizedEvent. Idempotent and safe to re-run: customers
 * and cases are upserted, and each case's NormalizedEvents are replaced
 * wholesale from a fresh derivation rather than appended to.
 */
export async function runZendeskNormalization(
  prisma: PrismaClient,
  integrationId: string,
): Promise<NormalizationResult> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const organizationId = integration.organizationId;

  const result: NormalizationResult = {
    customersUpserted: 0,
    casesUpserted: 0,
    normalizedEventsWritten: 0,
    ticketsFailed: [],
  };

  const [orgRows, ticketRows, auditRows] = await Promise.all([
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "organization:" } },
      select: { id: true, payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "ticket:" } },
      select: { id: true, payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "ticket_audit:" } },
      select: { id: true, payload: true, fetchedAt: true },
    }),
  ]);

  const latestOrgs = latestSnapshotById<ZendeskOrganization>(orgRows);
  for (const { value: org } of latestOrgs.values()) {
    await prisma.customer.upsert({
      where: { organizationId_zendeskOrgId: { organizationId, zendeskOrgId: String(org.id) } },
      update: { name: org.name },
      create: { organizationId, name: org.name, zendeskOrgId: String(org.id) },
    });
    result.customersUpserted += 1;
  }

  const latestTickets = latestSnapshotById<ZendeskTicket>(ticketRows);
  const auditsByTicketId = groupAuditsByTicketId(auditRows);

  for (const { rawEventId: ticketRawEventId, value: ticket, rawEventIds: ticketSnapshotRawEventIds } of latestTickets.values()) {
    try {
      // Defense in depth: `runZendeskBackfill` routes "deleted"-status tickets
      // to soft-delete directly and never writes them as RawEvents, but a row
      // ingested before that filter existed could still be sitting here —
      // normalizeZendeskStatus has no mapping for "deleted" and would throw.
      if (ticket.status === "deleted") {
        await prisma.case.updateMany({
          where: { organizationId, externalId: String(ticket.id), deletedAt: null },
          data: { deletedAt: new Date() },
        });
        continue;
      }

      const customer =
        ticket.organization_id != null
          ? await prisma.customer.findUnique({
              where: {
                organizationId_zendeskOrgId: { organizationId, zendeskOrgId: String(ticket.organization_id) },
              },
            })
          : null;

      const auditsForTicket = auditsByTicketId.get(ticket.id) ?? [];
      const derived = deriveNormalizedEventsForTicket(ticket, auditsForTicket, ticketRawEventId);
      const closedAt = deriveCaseClosedAt(ticket, derived);
      // Every RawEvent this ticket's own derivation could ever have sourced
      // an event from — every ticket snapshot (each re-fetch with changes is
      // a new RawEvent, and an older one's case_created must not linger)
      // plus its own audits. Scoping the
      // regenerate-in-place delete to just these (like jira/normalize.ts and
      // linear/normalize.ts already do) keeps it from wiping NormalizedEvent
      // rows another provider (Jira/Linear) wrote onto the same case.
      const ownRawEventIds = [...ticketSnapshotRawEventIds, ...auditsForTicket.map((a) => a.rawEventId)];

      const caseRow = await prisma.case.upsert({
        where: { organizationId_externalId: { organizationId, externalId: String(ticket.id) } },
        update: {
          customerId: customer?.id ?? null,
          subject: ticket.subject,
          priority: ticket.priority,
          channel: ticket.via?.channel ?? null,
          closedAt,
        },
        create: {
          organizationId,
          customerId: customer?.id ?? null,
          externalId: String(ticket.id),
          system: "zendesk",
          subject: ticket.subject,
          priority: ticket.priority,
          channel: ticket.via?.channel ?? null,
          openedAt: new Date(ticket.created_at),
          closedAt,
        },
      });
      result.casesUpserted += 1;

      await prisma.$transaction([
        prisma.normalizedEvent.deleteMany({
          where: { caseId: caseRow.id, sourceRawEventId: { in: ownRawEventIds } },
        }),
        prisma.normalizedEvent.createMany({
          data: derived.map((event) => ({
            caseId: caseRow.id,
            sourceRawEventId: event.sourceRawEventId,
            type: event.type,
            occurredAt: new Date(event.occurredAt),
            actor: event.actor,
            system: "zendesk" as const,
            fromState: event.fromState,
            toState: event.toState,
          })) satisfies Prisma.NormalizedEventCreateManyInput[],
        }),
      ]);
      result.normalizedEventsWritten += derived.length;
    } catch (error) {
      result.ticketsFailed.push({
        ticketId: ticket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
