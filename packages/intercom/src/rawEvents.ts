import { computeSourceHash } from "./hash";
import type { IntercomAdmin, IntercomCompany, IntercomContact, IntercomConversation, IntercomConversationPart } from "./types";

/** What gets written to one RawEvent row, minus the integrationId FK. */
export interface RawEventInput {
  providerEventId: string;
  sourceHash: string;
  payload: unknown;
}

/**
 * Conversations, companies, and contacts are mutable snapshots, not events.
 * The hash is folded into the provider event id so an unchanged re-fetch
 * collides with the existing row (skipped via skipDuplicates) while a real
 * change lands as a new, distinct RawEvent — append-only either way, mirroring
 * mapTicketToRawEvent in @sla/zendesk.
 */
export function mapConversationToRawEvent(conversation: IntercomConversation): RawEventInput {
  const sourceHash = computeSourceHash(conversation);
  return { providerEventId: `conversation:${conversation.id}:${sourceHash}`, sourceHash, payload: conversation };
}

/**
 * Conversation parts are Intercom's immutable event log — each part id
 * occurs exactly once, ever, so no hash suffix is needed for dedup (mirroring
 * mapAuditToRawEvent in @sla/zendesk).
 */
export function mapConversationPartToRawEvent(
  conversationId: string,
  part: IntercomConversationPart,
): RawEventInput {
  return {
    providerEventId: `conversation_part:${conversationId}:${part.id}`,
    sourceHash: computeSourceHash(part),
    payload: part,
  };
}

export function mapCompanyToRawEvent(company: IntercomCompany): RawEventInput {
  const sourceHash = computeSourceHash(company);
  return { providerEventId: `company:${company.id}:${sourceHash}`, sourceHash, payload: company };
}

export function mapContactToRawEvent(contact: IntercomContact): RawEventInput {
  const sourceHash = computeSourceHash(contact);
  return { providerEventId: `contact:${contact.id}:${sourceHash}`, sourceHash, payload: contact };
}

/** Only `{ id, name }` is kept — the one field the normalizer reads to resolve `admin_assignee_id` (D10/3.6), mirroring `mapUserToRawEvent` in @sla/zendesk. */
export function mapAdminToRawEvent(admin: IntercomAdmin): RawEventInput {
  const payload = { id: admin.id, name: admin.name ?? null };
  const sourceHash = computeSourceHash(payload);
  return { providerEventId: `admin:${admin.id}:${sourceHash}`, sourceHash, payload };
}
