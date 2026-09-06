import { computeSourceHash } from "./hash";
import type {
  ZendeskAudit,
  ZendeskBusinessHoursSchedule,
  ZendeskOrganization,
  ZendeskScheduleHoliday,
  ZendeskSlaPolicy,
  ZendeskTicket,
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
 */
export function mapTicketToRawEvent(ticket: ZendeskTicket): RawEventInput {
  const sourceHash = computeSourceHash(ticket);
  return { providerEventId: `ticket:${ticket.id}:${sourceHash}`, sourceHash, payload: ticket };
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
