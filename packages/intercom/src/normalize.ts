import type { Prisma, PrismaClient } from "@sla/db";
import type { Actor, NormalizedEventType, NormalizedState } from "@sla/core";
import type {
  IntercomContact,
  IntercomConversationPart,
  IntercomConversationState,
  IntercomConversationWithParts,
} from "./types";

/**
 * Intercom's closed, three-value conversation lifecycle, mapped to the
 * provider-independent vocabulary. A flatter mapping than Zendesk's six
 * statuses: Intercom has no separate "new" (a conversation starts "open") and
 * no distinct pending-customer/pending-internal split, so "snoozed" — an
 * agent deliberately deferring it — is the closest analog to
 * `pending_internal`.
 */
const STATE_TO_NORMALIZED_STATE: Record<IntercomConversationState, NormalizedState> = {
  open: "open",
  snoozed: "pending_internal",
  closed: "resolved",
};

export class UnknownIntercomStateError extends Error {
  constructor(state: string) {
    super(`Unknown Intercom conversation state: ${state}`);
    this.name = "UnknownIntercomStateError";
  }
}

export function normalizeIntercomState(state: string): NormalizedState {
  const mapped = STATE_TO_NORMALIZED_STATE[state as IntercomConversationState];
  if (!mapped) throw new UnknownIntercomStateError(state);
  return mapped;
}

/**
 * The subset of Intercom's wide `part_type` vocabulary (comment, note,
 * assignment, language_detection_details, conversation_rating_changed, ...)
 * that represents a state transition. Everything else is ignored, not an
 * error — unlike Zendesk's audit `Change` events, Intercom documents no
 * closed set of part types.
 */
const TRANSITION_PART_TYPE_TO_STATE: Record<string, IntercomConversationState> = {
  close: "closed",
  open: "open",
  snoozed: "snoozed",
};

/** Channels Intercom uses when an automation/workflow made the change, not a person. */
const SYSTEM_AUTHOR_TYPES = new Set(["bot", "team", "operator"]);

/**
 * Best-effort actor resolution: a bot/automation author is "system", an admin
 * is "agent", and a contact (Intercom's "user"/"lead"/"contact" author types)
 * is "customer". Defaults to "agent" for anything unrecognized, mirroring
 * `resolveActor` in @sla/zendesk — most conversation activity is agent-side.
 */
export function resolveIntercomActor(author: { type: string } | null | undefined): Actor {
  if (!author) return "system";
  if (SYSTEM_AUTHOR_TYPES.has(author.type)) return "system";
  if (author.type === "user" || author.type === "lead" || author.type === "contact") return "customer";
  return "agent";
}

export interface ConversationPartRecord {
  /** The RawEvent row id this part was read from — becomes NormalizedEvent.sourceRawEventId. */
  rawEventId: string;
  part: IntercomConversationPart;
}

export interface DerivedNormalizedEvent {
  type: NormalizedEventType;
  occurredAt: string;
  actor: Actor;
  fromState: NormalizedState | null;
  toState: NormalizedState;
  sourceRawEventId: string;
}

export function sortPartsChronologically(parts: ConversationPartRecord[]): ConversationPartRecord[] {
  return [...parts].sort((a, b) => {
    const byTime = a.part.created_at - b.part.created_at;
    return byTime !== 0 ? byTime : a.part.id.localeCompare(b.part.id);
  });
}

/**
 * `RawEvent` → `NormalizedEvent` for one conversation. Regenerated from
 * scratch on every run (never diffed incrementally), mirroring
 * `deriveNormalizedEventsForTicket` in @sla/zendesk.
 *
 * Unlike Zendesk's audit `Change` events, an Intercom conversation part
 * carries no explicit before/after state — a "close" part just says "this
 * closed now". So the derivation replays parts chronologically, tracking the
 * conversation's own running state starting from "open" (every conversation
 * starts open) rather than reading an explicit previous value off each event.
 * A transition part whose target state matches the currently-tracked state
 * (a redundant re-close, say) is skipped rather than emitted as a no-op.
 */
export function deriveNormalizedEventsForConversation(
  conversation: IntercomConversationWithParts,
  partsForConversation: ConversationPartRecord[],
  conversationRawEventId: string,
): DerivedNormalizedEvent[] {
  const sorted = sortPartsChronologically(partsForConversation);
  const transitions = sorted
    .map((record) => ({ ...record, targetState: TRANSITION_PART_TYPE_TO_STATE[record.part.part_type] }))
    .filter((record): record is ConversationPartRecord & { targetState: IntercomConversationState } =>
      record.targetState !== undefined,
    );

  const events: DerivedNormalizedEvent[] = [
    {
      type: "case_created",
      occurredAt: new Date(conversation.created_at * 1000).toISOString(),
      actor: resolveIntercomActor(conversation.source?.author),
      fromState: null,
      toState: normalizeIntercomState("open"),
      sourceRawEventId: conversationRawEventId,
    },
  ];

  let currentState: IntercomConversationState = "open";
  for (const { rawEventId, part, targetState } of transitions) {
    if (targetState === currentState) continue;

    const toState = normalizeIntercomState(targetState);
    events.push({
      // Intercom's only terminal state is "closed" — a conversation reopened
      // after that (targetState "open") is a plain state_changed, same as
      // Zendesk's solved-then-reopened case.
      type: toState === "resolved" ? "case_closed" : "state_changed",
      occurredAt: new Date(part.created_at * 1000).toISOString(),
      actor: resolveIntercomActor(part.author),
      fromState: normalizeIntercomState(currentState),
      toState,
      sourceRawEventId: rawEventId,
    });
    currentState = targetState;
  }

  return events;
}

/**
 * `Case.closedAt` for a conversation: set once it reaches Intercom's one
 * terminal state ("closed"), timestamped from the most recent transition
 * into it — mirrors `deriveCaseClosedAt` in @sla/zendesk. Falls back to
 * `conversation.updated_at` when no case_closed event was derived at all — a
 * conversation fetched for the first time already closed, with no part
 * history recorded for the transition.
 */
export function deriveCaseClosedAt(
  conversation: IntercomConversationWithParts,
  derivedEvents: DerivedNormalizedEvent[],
): Date | null {
  if (conversation.state !== "closed") return null;

  const closureEvent = [...derivedEvents].reverse().find((event) => event.type === "case_closed");
  return closureEvent ? new Date(closureEvent.occurredAt) : new Date(conversation.updated_at * 1000);
}

export interface NormalizationResult {
  customersUpserted: number;
  casesUpserted: number;
  normalizedEventsWritten: number;
  conversationsFailed: { conversationId: string; error: string }[];
}

/** Keeps, per string `id` embedded in each row's JSON payload, the row with the latest fetchedAt. */
function latestSnapshotById<T extends { id: string }>(
  rows: { id: string; payload: unknown; fetchedAt: Date }[],
): Map<string, { rawEventId: string; value: T; fetchedAt: Date }> {
  const byId = new Map<string, { rawEventId: string; value: T; fetchedAt: Date }>();
  for (const row of rows) {
    const value = row.payload as T;
    const existing = byId.get(value.id);
    if (!existing || row.fetchedAt >= existing.fetchedAt) {
      byId.set(value.id, { rawEventId: row.id, value, fetchedAt: row.fetchedAt });
    }
  }
  return byId;
}

/** `conversation_part:{conversationId}:{partId}` — parts carry no conversation id of their own. */
function groupPartsByConversationId(
  rows: { id: string; providerEventId: string; payload: unknown }[],
): Map<string, ConversationPartRecord[]> {
  const byConversationId = new Map<string, ConversationPartRecord[]>();
  for (const row of rows) {
    const conversationId = row.providerEventId.split(":")[1];
    if (!conversationId) continue;
    const record: ConversationPartRecord = { rawEventId: row.id, part: row.payload as IntercomConversationPart };
    const group = byConversationId.get(conversationId);
    if (group) group.push(record);
    else byConversationId.set(conversationId, [record]);
  }
  return byConversationId;
}

/**
 * Projects everything ingested so far for one integration into
 * Customer/Case/NormalizedEvent, mirroring `runZendeskNormalization`.
 * Idempotent and safe to re-run: customers and cases are upserted, and each
 * conversation's NormalizedEvents are replaced wholesale from a fresh
 * derivation rather than appended to.
 *
 * A conversation's customer is resolved by following its primary contact
 * (`conversation.contacts.contacts[0]`) to that contact's first company —
 * Intercom conversations carry no company id directly, unlike a Zendesk
 * ticket's `organization_id`. A conversation with no contact, or a contact
 * with no company, gets a case with `customerId: null` rather than being
 * skipped — same as an unmatched Zendesk ticket.
 */
export async function runIntercomNormalization(
  prisma: PrismaClient,
  integrationId: string,
): Promise<NormalizationResult> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const organizationId = integration.organizationId;

  const result: NormalizationResult = {
    customersUpserted: 0,
    casesUpserted: 0,
    normalizedEventsWritten: 0,
    conversationsFailed: [],
  };

  const [companyRows, contactRows, conversationRows, partRows] = await Promise.all([
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "company:" } },
      select: { id: true, payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "contact:" } },
      select: { id: true, payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "conversation:" } },
      select: { id: true, payload: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    }),
    prisma.rawEvent.findMany({
      where: { integrationId, providerEventId: { startsWith: "conversation_part:" } },
      select: { id: true, providerEventId: true, payload: true },
    }),
  ]);

  const latestCompanies = latestSnapshotById<{ id: string; name: string }>(companyRows);
  for (const { value: company } of latestCompanies.values()) {
    await prisma.customer.upsert({
      where: { organizationId_intercomCompanyId: { organizationId, intercomCompanyId: company.id } },
      update: { name: company.name },
      create: { organizationId, name: company.name, intercomCompanyId: company.id },
    });
    result.customersUpserted += 1;
  }

  const latestContacts = latestSnapshotById<IntercomContact>(contactRows);
  const latestConversations = latestSnapshotById<IntercomConversationWithParts>(conversationRows);
  const partsByConversationId = groupPartsByConversationId(partRows);

  for (const { rawEventId: conversationRawEventId, value: conversation } of latestConversations.values()) {
    try {
      const primaryContactId = conversation.contacts?.contacts[0]?.id;
      const companyId = primaryContactId
        ? latestContacts.get(primaryContactId)?.value.companies?.data[0]?.id
        : undefined;
      const customer = companyId
        ? await prisma.customer.findUnique({
            where: { organizationId_intercomCompanyId: { organizationId, intercomCompanyId: companyId } },
          })
        : null;

      const partsForConversation = partsByConversationId.get(conversation.id) ?? [];
      const derived = deriveNormalizedEventsForConversation(conversation, partsForConversation, conversationRawEventId);
      const closedAt = deriveCaseClosedAt(conversation, derived);
      // Every RawEvent this conversation's own derivation could ever have
      // sourced an event from — scoping the regenerate-in-place delete to
      // just these (like @sla/zendesk's normalizer) keeps it from wiping
      // NormalizedEvent rows another provider wrote onto the same case.
      const ownRawEventIds = [conversationRawEventId, ...partsForConversation.map((p) => p.rawEventId)];

      const caseRow = await prisma.case.upsert({
        where: { organizationId_externalId: { organizationId, externalId: conversation.id } },
        update: {
          customerId: customer?.id ?? null,
          priority: conversation.priority ?? null,
          channel: conversation.source?.type ?? null,
          closedAt,
        },
        create: {
          organizationId,
          customerId: customer?.id ?? null,
          externalId: conversation.id,
          system: "intercom",
          priority: conversation.priority ?? null,
          channel: conversation.source?.type ?? null,
          openedAt: new Date(conversation.created_at * 1000),
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
            system: "intercom" as const,
            fromState: event.fromState,
            toState: event.toState,
          })) satisfies Prisma.NormalizedEventCreateManyInput[],
        }),
      ]);
      result.normalizedEventsWritten += derived.length;
    } catch (error) {
      result.conversationsFailed.push({
        conversationId: conversation.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
