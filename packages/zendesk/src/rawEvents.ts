import { computeSourceHash } from "./hash";
import type {
  ZendeskAudit,
  ZendeskBusinessHoursSchedule,
  ZendeskOrganization,
  ZendeskScheduleHoliday,
  ZendeskSlaPolicy,
  ZendeskTicket,
  ZendeskUser,
} from "./types";

/** What gets written to one RawEvent row, minus the integrationId FK. */
export interface RawEventInput {
  providerEventId: string;
  sourceHash: string;
  payload: unknown;
}

/**
 * Ticket audits are Zendesk's immutable event log — each audit id occurs
 * exactly once, ever, so no hash suffix is needed for dedup.
 */
export function mapAuditToRawEvent(audit: ZendeskAudit): RawEventInput {
  return {
    providerEventId: `ticket_audit:${audit.id}`,
    sourceHash: computeSourceHash(audit),
    payload: audit,
  };
}

/**
 * Tickets, organizations, and SLA policies are mutable snapshots, not
 * events. The hash is folded into the provider event id so an unchanged
 * re-fetch collides with the existing row (skipped via skipDuplicates) while
 * a real change lands as a new, distinct RawEvent — append-only either way.
 *
 * `users` is the `include=users` sideload returned alongside the ticket
 * (`fetchTicket`/`fetchTicketsPage`/`fetchTicketsNextPage`) — used only to
 * resolve `ticket.requester_id` to a display name, embedded onto the
 * snapshot as `requester_name` before it's hashed and stored. This is the
 * only place the requester's name is persisted; no separate `user:` RawEvent
 * is written for it, so it never joins the audit-authors' `{id, role}`
 * stream `mapUserToRawEvent` writes.
 */
export function mapTicketToRawEvent(ticket: ZendeskTicket, users: ZendeskUser[] = []): RawEventInput {
  const requester = ticket.requester_id != null ? users.find((user) => user.id === ticket.requester_id) : undefined;
  const payload: ZendeskTicket = { ...ticket, requester_name: requester?.name ?? null };
  const sourceHash = computeSourceHash(payload);
  return { providerEventId: `ticket:${ticket.id}:${sourceHash}`, sourceHash, payload };
}

/**
 * Only `{ id, role }` is kept, not the full sideloaded user: role is the one
 * field the normalizer reads, and it avoids storing end users' names, emails
 * and phone numbers. It also means a new snapshot lands only when the role
 * itself changes, not on every profile edit.
 */
export function mapUserToRawEvent(user: ZendeskUser): RawEventInput {
  const payload = { id: user.id, role: user.role };
  const sourceHash = computeSourceHash(payload);
  return { providerEventId: `user:${user.id}:${sourceHash}`, sourceHash, payload };
}

export function mapOrganizationToRawEvent(organization: ZendeskOrganization): RawEventInput {
  const sourceHash = computeSourceHash(organization);
  return {
    providerEventId: `organization:${organization.id}:${sourceHash}`,
    sourceHash,
    payload: organization,
  };
}

export function mapSlaPolicyToRawEvent(policy: ZendeskSlaPolicy): RawEventInput {
  const sourceHash = computeSourceHash(policy);
  return {
    providerEventId: `sla_policy:${policy.id}:${sourceHash}`,
    sourceHash,
    payload: policy,
  };
}

export function mapBusinessHoursScheduleToRawEvent(schedule: ZendeskBusinessHoursSchedule): RawEventInput {
  const sourceHash = computeSourceHash(schedule);
  return {
    providerEventId: `business_hours_schedule:${schedule.id}:${sourceHash}`,
    sourceHash,
    payload: schedule,
  };
}

/** One snapshot per schedule bundling its full holiday list, mirroring how tickets/policies snapshot rather than diff. */
export interface ScheduleHolidaysSnapshot {
  scheduleId: number;
  holidays: ZendeskScheduleHoliday[];
}

export function mapScheduleHolidaysToRawEvent(snapshot: ScheduleHolidaysSnapshot): RawEventInput {
  const sourceHash = computeSourceHash(snapshot);
  return {
    providerEventId: `schedule_holidays:${snapshot.scheduleId}:${sourceHash}`,
    sourceHash,
    payload: snapshot,
  };
}
