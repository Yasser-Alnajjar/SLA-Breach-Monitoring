/**
 * Customer (account/company) and Requester (the individual who submitted
 * the ticket) must never be merged in the UI: a requester is never shown as
 * if it were the customer, and a case with no customer never renders a
 * dangling "Customer: —". `formatCaseIdentity` is the single place
 * CaseHeader decides what to show for a case's identity line.
 */
import { describe, expect, it } from "vitest";
import { formatCaseIdentity } from "@modules/cases/case-detail/csr/CaseHeader";

describe("formatCaseIdentity", () => {
  it("shows both, with the requester clearly labeled, when a customer and a requester both exist", () => {
    expect(formatCaseIdentity("Acme Corp", "Ahmed")).toBe("Acme Corp · Requester: Ahmed");
  });

  it("shows only the customer, unlabeled and unchanged, when there is no requester", () => {
    expect(formatCaseIdentity("Acme Corp", null)).toBe("Acme Corp");
  });

  it("labels the requester explicitly when there is no customer — never a bare name in the customer's slot", () => {
    const result = formatCaseIdentity(null, "Ahmed");
    expect(result).toBe("Requester: Ahmed");
    expect(result).not.toBe("Ahmed");
  });

  it("falls back to a plain dash when neither exists, with no misleading 'Customer' or 'Requester' label", () => {
    const result = formatCaseIdentity(null, null);
    expect(result).toBe("—");
    expect(result).not.toContain("Customer");
    expect(result).not.toContain("Requester");
  });
});
