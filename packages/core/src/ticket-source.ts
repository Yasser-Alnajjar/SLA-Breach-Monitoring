import type { NormalizedEvent } from "./types";

/**
 * Ticket-source systems — the ones that create Cases and own their lifecycle
 * (roadmap step 22 added Intercom beside Zendesk). Shared by every place that
 * reasons about a case's own open/closed/solved state, replies, or first
 * response: `evaluate.ts` (`findCaseCloseEvent`, `findFirstResponseEvent`,
 * `resolveFirstResponseStartedAt`) and `reply-cycles.ts`
 * (`deriveNextReplyCycles`). A linked Jira issue is never the anchor for a
 * case's lifecycle, so it's deliberately excluded.
 */
export const TICKET_SOURCE_SYSTEMS = new Set<NormalizedEvent["system"]>(["zendesk", "intercom"]);
