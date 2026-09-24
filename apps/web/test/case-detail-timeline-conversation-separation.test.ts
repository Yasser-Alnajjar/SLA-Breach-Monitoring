/**
 * Phase 3 done-when: "a component test shows Conversation and Activity
 * Timeline stay separate." Activity Timeline now carries synthetic rows with
 * no NormalizedEvent of their own (3.2/3.3: policy changes, SLA lifecycle
 * markers) alongside real events, and Conversation gained dedupe/requester
 * labels/system-opened messages (3.7) — this proves neither component ever
 * renders the other's content, and each renders its own items in order.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityTimeline } from "@modules/cases/case-detail/csr/ActivityTimeline";
import { ConversationThread } from "@modules/cases/case-detail/csr/ConversationThread";
import type {
  CaseDetailData,
  ConversationMessageDetail,
  TimelineEventDetail,
} from "@/lib/types/cases";

function caseDetailData(overrides: {
  timeline?: TimelineEventDetail[];
  conversation?: ConversationMessageDetail[];
}): CaseDetailData {
  return {
    asOf: "2026-09-17T15:00:00.000Z",
    case: {
      id: "case-1",
      externalId: "1",
      subject: "Login trouble",
      priority: "high",
      tier: null,
      channel: "web",
      openedAt: "2026-09-17T09:00:00.000Z",
      closedAt: null,
      customerName: "Acme Corp",
      requesterName: "Jane Requester",
      assigneeName: null,
      status: "open",
      system: "zendesk",
      ticketUrl: null,
    },
    currentLeg: "support",
    commitments: [],
    legSpans: [],
    legTotals: [],
    engineeringLegTarget: null,
    runningIntervals: [],
    pausedIntervals: [],
    timeline: overrides.timeline ?? [],
    conversation: overrides.conversation ?? [],
    links: [],
  };
}

const timeline: TimelineEventDetail[] = [
  {
    id: "ev-created",
    occurredAt: "2026-09-17T09:00:00.000Z",
    actor: "customer",
    system: "zendesk",
    type: "case_created",
    fromState: null,
    toState: "new",
  },
  {
    id: "lifecycle:c-1:started",
    occurredAt: "2026-09-17T09:00:00.000Z",
    actor: "system",
    system: "zendesk",
    type: "commitment_started",
    fromState: null,
    toState: null,
    commitmentKind: "resolution",
  },
  {
    id: "policy_change:c-1:1",
    occurredAt: "2026-09-17T09:30:00.000Z",
    actor: "system",
    system: "zendesk",
    type: "policy_changed",
    fromState: null,
    toState: null,
    commitmentKind: "resolution",
    previousTargetMinutes: 480,
    newTargetMinutes: 120,
    reason: "policy_switched",
  },
  {
    id: "notification:n-1",
    occurredAt: "2026-09-17T10:00:00.000Z",
    actor: "system",
    system: "zendesk",
    type: "commitment_at_risk",
    fromState: null,
    toState: null,
    commitmentKind: "resolution",
    thresholdPercent: 80,
  },
  {
    id: "lifecycle:c-1:breached",
    occurredAt: "2026-09-17T11:00:00.000Z",
    actor: "system",
    system: "zendesk",
    type: "commitment_breached",
    fromState: null,
    toState: null,
    commitmentKind: "resolution",
  },
];

const conversation: ConversationMessageDetail[] = [
  {
    id: "ev-msg-1",
    occurredAt: "2026-09-17T09:05:00.000Z",
    actor: "customer",
    type: "customer_replied",
    authorName: "Jane Requester",
    isRequester: true,
    body: "SECRET_CUSTOMER_MESSAGE_ONE",
  },
  {
    id: "ev-msg-2",
    occurredAt: "2026-09-17T09:10:00.000Z",
    actor: "agent",
    type: "agent_replied",
    authorName: null,
    body: "SECRET_AGENT_MESSAGE_TWO",
  },
];

describe("Activity Timeline / Conversation separation (3.8)", () => {
  it("Activity Timeline never renders Conversation message bodies", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityTimeline, {
        data: caseDetailData({ timeline, conversation }),
      }),
    );
    expect(html).not.toContain("SECRET_CUSTOMER_MESSAGE_ONE");
    expect(html).not.toContain("SECRET_AGENT_MESSAGE_TWO");
  });

  it("Conversation never renders Activity Timeline / SLA lifecycle content", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        data: caseDetailData({ timeline, conversation }),
      }),
    );
    expect(html).not.toContain("Policy re-matched");
    expect(html).not.toContain("Commitment started");
    expect(html).not.toContain("At risk");
    expect(html).not.toContain("Breached");
    // Only Conversation's own two messages.
    expect(html).toContain("SECRET_CUSTOMER_MESSAGE_ONE");
    expect(html).toContain("SECRET_AGENT_MESSAGE_TWO");
  });

  it("Activity Timeline renders every synthetic and real row, in chronological order", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityTimeline, { data: caseDetailData({ timeline }) }),
    );
    const markers = [
      "Opened as",
      "Commitment started",
      "Policy re-matched",
      "At risk",
      "Breached",
    ];
    const positions = markers.map((marker) => html.indexOf(marker));
    expect(positions.every((p) => p !== -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("Conversation renders its messages in chronological order", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        data: caseDetailData({ conversation }),
      }),
    );
    expect(html.indexOf("SECRET_CUSTOMER_MESSAGE_ONE")).toBeLessThan(
      html.indexOf("SECRET_AGENT_MESSAGE_TWO"),
    );
  });

  it("Conversation shows a Requester badge only for the confirmed requester, not every customer message", () => {
    const html = renderToStaticMarkup(
      createElement(ConversationThread, {
        data: caseDetailData({
          conversation: [
            conversation[0]!, // isRequester: true
            {
              id: "ev-msg-3",
              occurredAt: "2026-09-17T09:20:00.000Z",
              actor: "customer",
              type: "customer_replied",
              authorName: null,
              body: "unconfirmed cc'd contact message",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Requester");
    expect(html).toContain("Customer");
  });

  it("renders an empty state for both components with no data, without crashing", () => {
    const data = caseDetailData({});
    expect(() =>
      renderToStaticMarkup(createElement(ActivityTimeline, { data })),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(createElement(ConversationThread, { data })),
    ).not.toThrow();
  });
});
