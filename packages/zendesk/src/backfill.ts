import type { Prisma, PrismaClient } from "@sla/db";
import { ZendeskClient } from "./client";
import {
  mapAuditToRawEvent,
  mapOrganizationToRawEvent,
  mapSlaPolicyToRawEvent,
  mapTicketToRawEvent,
  type RawEventInput,
} from "./rawEvents";
import type {
  ZendeskCredentials,
  ZendeskCursor,
  ZendeskIncrementalOrganizationExport,
  ZendeskIncrementalTicketExport,
} from "./types";

const DEFAULT_BACKFILL_DAYS = 90;
const INCREMENTAL_EXPORT_PAGE_SIZE = 1000; // Zendesk's fixed page size for these endpoints

export interface BackfillResult {
  ticketsFetched: number;
  ticketAuditsFetched: number;
  organizationsFetched: number;
  slaPoliciesFetched: number;
}

/**
 * Pulls tickets, ticket audits, organizations, and SLA policies into
 * RawEvent. Raw ingestion only — no normalization (roadmap step 3 does
 * that). Resumable: the cursor is persisted after every page, so a crash or
 * restart continues from the last completed page rather than the start.
 */
export async function runZendeskBackfill(
  prisma: PrismaClient,
  integrationId: string,
  credentials: ZendeskCredentials,
  options: { sinceDays?: number } = {},
): Promise<BackfillResult> {
  const integration = await prisma.integration.findUniqueOrThrow({
    where: { id: integrationId },
  });
  const cursor = ((integration.cursor as ZendeskCursor | null) ?? {}) as ZendeskCursor;
  const client = new ZendeskClient(credentials);
  const sinceDays = options.sinceDays ?? DEFAULT_BACKFILL_DAYS;
  const defaultStartTime = Math.floor(Date.now() / 1000) - sinceDays * 24 * 60 * 60;

  const result: BackfillResult = {
    ticketsFetched: 0,
    ticketAuditsFetched: 0,
    organizationsFetched: 0,
    slaPoliciesFetched: 0,
  };

  await backfillTickets();
  await backfillOrganizations();
  await backfillSlaPolicies();

  if (cursor.tickets && cursor.organizations) {
    cursor.backfillCompletedAt = new Date().toISOString();
    await persistCursor();
  }

  return result;

  async function backfillTickets(): Promise<void> {
    let startTime = cursor.tickets?.startTime ?? defaultStartTime;
    let nextPageUrl: string | null = null;

    for (;;) {
      const page: ZendeskIncrementalTicketExport = nextPageUrl
        ? await client.fetchTicketsNextPage(nextPageUrl)
        : await client.fetchTicketsPage(startTime);

      const rawEvents: RawEventInput[] = page.tickets.map(mapTicketToRawEvent);
      await writeRawEvents(rawEvents);
      result.ticketsFetched += page.tickets.length;

      for (const ticket of page.tickets) {
        result.ticketAuditsFetched += await backfillAuditsForTicket(ticket.id);
      }

      startTime = page.end_time;
      cursor.tickets = { startTime };
      await persistCursor();

      if (page.count < INCREMENTAL_EXPORT_PAGE_SIZE || !page.next_page) break;
      nextPageUrl = page.next_page;
    }
  }

  async function backfillAuditsForTicket(ticketId: number): Promise<number> {
    let nextPageUrl: string | undefined;
    let count = 0;

    for (;;) {
      const page = await client.fetchTicketAuditsPage(ticketId, nextPageUrl);
      await writeRawEvents(page.audits.map(mapAuditToRawEvent));
      count += page.audits.length;

      if (!page.next_page) break;
      nextPageUrl = page.next_page;
    }

    return count;
  }

  async function backfillOrganizations(): Promise<void> {
    let startTime = cursor.organizations?.startTime ?? defaultStartTime;
    let nextPageUrl: string | null = null;

    for (;;) {
      const page: ZendeskIncrementalOrganizationExport = nextPageUrl
        ? await client.fetchOrganizationsNextPage(nextPageUrl)
        : await client.fetchOrganizationsPage(startTime);

      await writeRawEvents(page.organizations.map(mapOrganizationToRawEvent));
      result.organizationsFetched += page.organizations.length;

      startTime = page.end_time;
      cursor.organizations = { startTime };
      await persistCursor();

      if (page.count < INCREMENTAL_EXPORT_PAGE_SIZE || !page.next_page) break;
      nextPageUrl = page.next_page;
    }
  }

  async function backfillSlaPolicies(): Promise<void> {
    let nextPageUrl: string | undefined;

    for (;;) {
      const page = await client.fetchSlaPoliciesPage(nextPageUrl);
      await writeRawEvents(page.sla_policies.map(mapSlaPolicyToRawEvent));
      result.slaPoliciesFetched += page.sla_policies.length;

      if (!page.next_page) break;
      nextPageUrl = page.next_page;
    }
  }

  async function writeRawEvents(inputs: RawEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await prisma.rawEvent.createMany({
      data: inputs.map((input) => ({
        integrationId,
        providerEventId: input.providerEventId,
        sourceHash: input.sourceHash,
        payload: input.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  async function persistCursor(): Promise<void> {
    await prisma.integration.update({
      where: { id: integrationId },
      data: { cursor: cursor as unknown as Prisma.InputJsonValue },
    });
  }
}
