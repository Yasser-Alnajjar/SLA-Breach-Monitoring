// Deep imports on purpose: the package index also re-exports the backfill
// and token code, which pulls in the Prisma client. The concierge run never
// touches a database.
import {
  deriveNormalizedEventsForTicket,
  normalizeZendeskStatus,
  type AuditRecord,
  type DerivedNormalizedEvent,
} from "@sla/zendesk/src/normalize";
import type { ZendeskAudit, ZendeskTicket } from "@sla/zendesk/src/types";
import { DropCounter, requireColumns, type CsvTable } from "./csv";
import { parseTimestamp } from "./time";

export const TICKET_COLUMNS = {
  id: ["id", "ticket id", "ticket_id", "ticket", "#"],
  createdAt: ["created at", "created_at", "created", "ticket created", "ticket created at", "created date"],
  status: ["status", "ticket status"],
  updatedAt: ["updated at", "updated_at", "updated", "ticket updated"],
  subject: ["subject", "ticket subject", "title"],
  priority: ["priority", "ticket priority"],
  organization: ["organization", "organization name", "organisation", "org", "account", "company"],
  requester: ["requester id", "requester_id", "requester", "requester email"],
  channel: ["via", "channel", "ticket channel", "via channel"],
  zendeskBreached: [
    "resolution breached",
    "resolution sla breached",
    "resolution time breached",
    "sla resolution breached",
    "sla breached",
    "breached",
  ],
  jiraKeys: ["jira issue keys", "jira issue key", "jira issues", "jira issue", "linked jira issues", "jira keys", "jira"],
} as const;

export const AUDIT_COLUMNS = {
  ticketId: ["ticket id", "ticket_id", "ticket"],
  createdAt: ["created at", "created_at", "created", "timestamp", "date", "audit created at", "changed at"],
  from: ["previous value", "previous_value", "from", "from status", "old value", "old status"],
  to: ["value", "to", "to status", "new value", "new status"],
  field: ["field", "field name", "field_name"],
  author: ["author id", "author_id", "author", "updater", "updated by"],
  channel: ["via", "channel", "via channel"],
} as const;

export interface ZendeskCase {
  ticket: ZendeskTicket;
  organization: string | null;
  /** Zendesk's own verdict on the resolution target, when the export carries one. */
  zendeskBreached: boolean | undefined;
  /** Jira keys written on the ticket side (e.g. an integration field). */
  jiraKeys: string[];
  events: DerivedNormalizedEvent[];
}

export interface ZendeskParseResult {
  cases: Map<string, ZendeskCase>;
  hasBreachColumn: boolean;
  ticketDrops: DropCounter;
  auditDrops: DropCounter;
  auditRowsUsed: number;
}

const STATUS_ALIASES: Record<string, string> = {
  "on-hold": "hold",
  "on hold": "hold",
  onhold: "hold",
};

function zendeskStatus(value: string | undefined): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const status = STATUS_ALIASES[lower] ?? lower;
  try {
    normalizeZendeskStatus(status);
    return status;
  } catch {
    return null;
  }
}

export function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase();
  if (["yes", "y", "true", "1", "breached", "missed"].includes(lower)) return true;
  if (["no", "n", "false", "0", "achieved", "met", "not breached"].includes(lower)) return false;
  return undefined;
}

export function extractJiraKeys(values: string[]): string[] {
  const keys = new Set<string>();
  for (const value of values) {
    for (const match of value.matchAll(/\b[A-Z][A-Z0-9_]+-\d+\b/g)) keys.add(match[0]);
  }
  return [...keys];
}

/**
 * People show up as numeric ids in API-shaped exports and as names or
 * emails in UI exports. Interning both to stable numbers lets the
 * normalizer's `author_id === requester_id` actor check work either way.
 */
class PersonIds {
  private readonly ids = new Map<string, number>();

  get(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const key = value.trim().toLowerCase();
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.ids.size + 1;
      this.ids.set(key, id);
    }
    return id;
  }
}

/**
 * Tickets CSV (one row per ticket) plus audits CSV (one row per status
 * change) → the `ZendeskTicket`/`ZendeskAudit` shapes the API adapter
 * ingests, then through the product's own `deriveNormalizedEventsForTicket`.
 */
export function parseZendeskExport(
  ticketsTable: CsvTable,
  auditsTable: CsvTable,
  timeZone: string,
): ZendeskParseResult {
  const tc = requireColumns("zendesk tickets", ticketsTable, {
    id: TICKET_COLUMNS.id,
    "created at": TICKET_COLUMNS.createdAt,
    status: TICKET_COLUMNS.status,
  });
  const ac = requireColumns("zendesk audits", auditsTable, {
    "ticket id": AUDIT_COLUMNS.ticketId,
    "created at": AUDIT_COLUMNS.createdAt,
    "previous status": AUDIT_COLUMNS.from,
    "new status": AUDIT_COLUMNS.to,
  });

  const people = new PersonIds();
  const ticketDrops = new DropCounter();
  const auditDrops = new DropCounter();
  const tickets = new Map<number, Omit<ZendeskCase, "events">>();

  for (const row of ticketsTable.rows) {
    const idText = tc.get(row, TICKET_COLUMNS.id)?.replace(/^#/, "");
    if (!idText || !/^\d+$/.test(idText)) {
      ticketDrops.add("missing or non-numeric ticket id");
      continue;
    }
    const createdAt = parseTimestamp(tc.get(row, TICKET_COLUMNS.createdAt) ?? "", timeZone);
    if (!createdAt) {
      ticketDrops.add("unreadable created date");
      continue;
    }
    const rawStatus = tc.get(row, TICKET_COLUMNS.status);
    if (rawStatus?.toLowerCase() === "deleted") {
      ticketDrops.add("deleted ticket");
      continue;
    }
    const status = zendeskStatus(rawStatus);
    if (!status) {
      ticketDrops.add(`unknown status "${rawStatus ?? ""}"`);
      continue;
    }
    const id = Number(idText);
    if (tickets.has(id)) {
      ticketDrops.add("duplicate ticket id (first row kept)");
      continue;
    }
    const channel = tc.get(row, TICKET_COLUMNS.channel)?.toLowerCase();
    tickets.set(id, {
      ticket: {
        id,
        url: "",
        external_id: null,
        subject: tc.get(row, TICKET_COLUMNS.subject) ?? null,
        created_at: createdAt,
        updated_at: parseTimestamp(tc.get(row, TICKET_COLUMNS.updatedAt) ?? "", timeZone) ?? createdAt,
        status,
        priority: tc.get(row, TICKET_COLUMNS.priority)?.toLowerCase() ?? null,
        organization_id: null,
        requester_id: people.get(tc.get(row, TICKET_COLUMNS.requester)) ?? null,
        via: channel ? { channel } : undefined,
      },
      organization: tc.get(row, TICKET_COLUMNS.organization) ?? null,
      zendeskBreached: parseBoolean(tc.get(row, TICKET_COLUMNS.zendeskBreached)),
      jiraKeys: extractJiraKeys(tc.getAll(row, TICKET_COLUMNS.jiraKeys)),
    });
  }

  const auditsByTicket = new Map<number, AuditRecord[]>();
  let auditRowsUsed = 0;
  auditsTable.rows.forEach((row, index) => {
    const field = ac.get(row, AUDIT_COLUMNS.field);
    if (field && field.toLowerCase() !== "status") {
      auditDrops.add("not a status change (ignored)");
      return;
    }
    const ticketIdText = ac.get(row, AUDIT_COLUMNS.ticketId)?.replace(/^#/, "");
    const ticketId = ticketIdText && /^\d+$/.test(ticketIdText) ? Number(ticketIdText) : null;
    if (ticketId === null) {
      auditDrops.add("missing or non-numeric ticket id");
      return;
    }
    const entry = tickets.get(ticketId);
    if (!entry) {
      auditDrops.add("ticket not in tickets export");
      return;
    }
    const createdAt = parseTimestamp(ac.get(row, AUDIT_COLUMNS.createdAt) ?? "", timeZone);
    if (!createdAt) {
      auditDrops.add("unreadable change date");
      return;
    }
    const rawFrom = ac.get(row, AUDIT_COLUMNS.from);
    const rawTo = ac.get(row, AUDIT_COLUMNS.to);
    const from = zendeskStatus(rawFrom);
    const to = zendeskStatus(rawTo);
    if (!from || !to) {
      auditDrops.add(`unknown status "${!from ? (rawFrom ?? "") : (rawTo ?? "")}"`);
      return;
    }
    if (from === to) {
      auditDrops.add("status unchanged (ignored)");
      return;
    }
    const channel = ac.get(row, AUDIT_COLUMNS.channel)?.toLowerCase();
    const audit: ZendeskAudit = {
      // Row order breaks same-timestamp ties, as the audit id does in the API.
      id: index + 1,
      ticket_id: ticketId,
      created_at: createdAt,
      author_id: people.get(ac.get(row, AUDIT_COLUMNS.author)) ?? -1,
      via: channel ? { channel } : undefined,
      events: [{ id: index + 1, type: "Change", field_name: "status", value: to, previous_value: from }],
    };
    const record: AuditRecord = { rawEventId: `zendesk-audit-row:${index + 2}`, audit };
    const group = auditsByTicket.get(ticketId);
    if (group) group.push(record);
    else auditsByTicket.set(ticketId, [record]);
    auditRowsUsed += 1;
  });

  const cases = new Map<string, ZendeskCase>();
  for (const [id, entry] of tickets) {
    const events = deriveNormalizedEventsForTicket(entry.ticket, auditsByTicket.get(id) ?? [], `zendesk-ticket:${id}`);
    cases.set(String(id), { ...entry, events });
  }

  return {
    cases,
    hasBreachColumn: tc.has(TICKET_COLUMNS.zendeskBreached),
    ticketDrops,
    auditDrops,
    auditRowsUsed,
  };
}
