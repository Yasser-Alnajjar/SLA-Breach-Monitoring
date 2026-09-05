import { BREACH_NOTIFICATION_THRESHOLD } from "@sla/core";
import { describe, expect, it } from "vitest";
import { formatSlackMessage } from "../src/format";

const baseCandidate = {
  commitmentId: "cmt_1",
  caseId: "case_1",
  kind: "resolution" as const,
  status: "at_risk" as const,
  threshold: 80,
  remainingMinutes: 45,
};

describe("formatSlackMessage", () => {
  it("names the customer and ticket for an at-risk warning", () => {
    const text = formatSlackMessage(baseCandidate, { externalId: "4821", customerName: "Acme Co." });
    expect(text).toContain("at risk");
    expect(text).toContain("#4821");
    expect(text).toContain("Acme Co.");
    expect(text).toContain("80%");
    expect(text).toContain("45m");
  });

  it("omits the customer clause when there is none", () => {
    const text = formatSlackMessage(baseCandidate, { externalId: "4821", customerName: null });
    expect(text).not.toContain("for ");
    expect(text).toContain("#4821");
  });

  it("distinguishes first_response from resolution", () => {
    const text = formatSlackMessage({ ...baseCandidate, kind: "first_response" }, {
      externalId: "1",
      customerName: null,
    });
    expect(text).toContain("First response");
  });

  it("reports a breach with elapsed-over time, not remaining time", () => {
    const text = formatSlackMessage(
      { ...baseCandidate, status: "breached", threshold: BREACH_NOTIFICATION_THRESHOLD, breachedByMinutes: 130 },
      { externalId: "4821", customerName: "Acme Co." },
    );
    expect(text).toContain("breached");
    expect(text).toContain("2h 10m");
    expect(text).not.toContain("%");
  });
});
