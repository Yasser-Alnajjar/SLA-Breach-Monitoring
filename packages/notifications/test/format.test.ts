import { BREACH_NOTIFICATION_THRESHOLD } from "@sla/core";
import { describe, expect, it } from "vitest";
import { formatEmailMessage, formatSlackMessage } from "../src/format";

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

describe("formatEmailMessage", () => {
  it("names the customer and ticket for an at-risk warning", () => {
    const { subject, text, html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: "Acme Co." });
    expect(subject).toContain("at risk");
    expect(subject).toContain("#4821");
    expect(text).toContain("#4821");
    expect(text).toContain("Acme Co.");
    expect(text).toContain("80%");
    expect(text).toContain("45m");
    expect(html).toContain("#4821");
    expect(html).toContain("Acme Co.");
    expect(html).toContain("80%");
    expect(html).toContain("45m");
  });

  it("omits the customer clause when there is none", () => {
    const { subject, text, html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: null });
    expect(subject).not.toContain("(");
    expect(text).toContain("#4821");
    expect(html).not.toContain("Customer:");
  });

  it("distinguishes first_response from resolution", () => {
    const { subject } = formatEmailMessage({ ...baseCandidate, kind: "first_response" }, {
      externalId: "1",
      customerName: null,
    });
    expect(subject).toContain("First response");
  });

  it("reports a breach with elapsed-over time, not remaining time", () => {
    const { subject, text, html } = formatEmailMessage(
      { ...baseCandidate, status: "breached", threshold: BREACH_NOTIFICATION_THRESHOLD, breachedByMinutes: 130 },
      { externalId: "4821", customerName: "Acme Co." },
    );
    expect(subject).toContain("breached");
    expect(text).toContain("2h 10m");
    expect(text).not.toContain("%");
    expect(html).toContain("2h 10m");
    expect(html).toContain("SLA BREACHED");
  });

  it("defaults the HTML brand name when none is given", () => {
    const { html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: null });
    expect(html).toContain("SLA Breach Monitoring");
  });

  it("uses the organization's configured brand name in the HTML body", () => {
    const { html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: null }, { name: "Acme Support" });
    expect(html).toContain("Acme Support");
    expect(html).not.toContain("SLA Breach Monitoring");
  });

  it("renders a ticket link only when a caseUrl is provided", () => {
    const withoutLink = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: null });
    expect(withoutLink.html).not.toContain("View ticket");

    const withLink = formatEmailMessage(
      baseCandidate,
      { externalId: "4821", customerName: null },
      { caseUrl: "https://app.example.com/cases/case_1" },
    );
    expect(withLink.html).toContain("View ticket");
    expect(withLink.html).toContain("https://app.example.com/cases/case_1");
  });

  it("escapes a customer name containing HTML special characters", () => {
    const { html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: "<b>Acme</b> & Co." });
    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt; &amp; Co.");
  });

  it("shows the ticket name above the ticket number in the HTML body when the case has a subject", () => {
    const { html } = formatEmailMessage(baseCandidate, {
      externalId: "4821",
      customerName: null,
      subject: "Payment webhook failing",
    });
    expect(html).toContain("Payment webhook failing");
    expect(html).toContain("Ticket #4821");
  });

  it("falls back to just the ticket number when the case has no subject", () => {
    const { html } = formatEmailMessage(baseCandidate, { externalId: "4821", customerName: null, subject: null });
    expect(html).toContain("#4821");
  });

  it("escapes a ticket name containing HTML special characters", () => {
    const { html } = formatEmailMessage(baseCandidate, {
      externalId: "4821",
      customerName: null,
      subject: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
