import { randomUUID } from "node:crypto";
import { computeSourceHash } from "./hash";
import type {
  ZendeskAudit,
  ZendeskBusinessHoursSchedule,
  ZendeskJiraLink,
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

/**
 * Official Zendesk↔Jira links are a mutable registry row (a link can be
 * removed and a new one created for the same ticket/issue pair), so — like
 * tickets — the hash is folded into the provider event id for append-only
 * dedup. Keyed by the link's own `id`, not by ticket/issue key, mirroring
 * `mapRemoteLinkToRawEvent`'s per-link keying in packages/jira/src/rawEvents.ts.
 */
export function mapJiraLinkToRawEvent(link: ZendeskJiraLink): RawEventInput {
  const sourceHash = computeSourceHash(link);
  return { providerEventId: `jira_link:${link.id}:${sourceHash}`, sourceHash, payload: link };
}

/** What the importer reads back to tell "no longer live in Zendesk" (unlinked) apart from "never fetched". */
export interface JiraLinkManifest {
  linkIds: number[];
}

/**
 * `backfillJiraLinks` re-fetches the entire official Jira-links registry
 * every run (like SLA policies — no incremental filter is available), so the
 * full set of link ids seen in one run is exactly the set of relationships
 * currently active in Zendesk. Recorded as its own snapshot, separate from
 * the per-link `jira_link:` rows, so `runZendeskJiraLinkCorrelation`
 * (./correlate.ts) can tell "this ticket was unlinked from this issue in
 * Zendesk" apart from "we just haven't re-fetched it yet" — a Zendesk unlink
 * has no deletion event of its own to react to, only the link's absence from
 * a fresh full listing.
 *
 * Deliberately does NOT fold the content hash into `providerEventId` the way
 * `mapSlaPolicyManifestToRawEvent` and every other manifest/snapshot mapper
 * in this file do: the correlator picks the *latest* manifest by `fetchedAt`
 * to decide what's currently linked, and a link set can legitimately
 * oscillate back to a set it held before (unlink, then re-link the same
 * issue) — content-hash dedup would collapse that reaffirming write onto the
 * original row's *old* timestamp, making the correlator read a stale
 * manifest as the latest one. `randomUUID` guarantees every run gets its own
 * row instead; the table only grows by one small row per Zendesk backfill.
 */
export function mapJiraLinkManifestToRawEvent(linkIds: number[]): RawEventInput {
  const payload: JiraLinkManifest = { linkIds: [...linkIds].sort((a, b) => a - b) };
  const sourceHash = computeSourceHash(payload);
  return { providerEventId: `jira_link_manifest:${randomUUID()}`, sourceHash, payload };
}

/** What the importer reads back to tell "no longer live in Zendesk" apart from "never fetched". */
export interface SlaPolicyManifest {
  policyIds: number[];
}

/**
 * `backfillSlaPolicies` re-fetches the *entire* SLA policy list every run
 * (unlike tickets/organizations, which are cursor-paginated deltas), so the
 * full set of ids seen in one run is exactly the set of policies currently
 * live in Zendesk. Recorded as its own snapshot, separate from the
 * per-policy `sla_policy:` rows, so `runZendeskSlaPolicyImport` (E-9) can
 * archive a `SLAPolicy` whose id no longer appears in the latest manifest —
 * a deleted/deactivated Zendesk policy never has a "deletion event" of its
 * own to react to, only the absence of its id from a fresh full listing.
 */
export function mapSlaPolicyManifestToRawEvent(policyIds: number[]): RawEventInput {
  const payload: SlaPolicyManifest = { policyIds: [...policyIds].sort((a, b) => a - b) };
  const sourceHash = computeSourceHash(payload);
  return { providerEventId: `sla_policy_manifest:${sourceHash}`, sourceHash, payload };
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
