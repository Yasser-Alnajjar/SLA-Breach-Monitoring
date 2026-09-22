import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "@sla/core";
import { normalizeZendeskTimeZone } from "../src/zendesk-timezone";

describe("normalizeZendeskTimeZone", () => {
  it("maps representative Rails display names to canonical IANA ids", () => {
    expect(normalizeZendeskTimeZone("Eastern Time (US & Canada)")).toBe("America/New_York");
    expect(normalizeZendeskTimeZone("Pacific Time (US & Canada)")).toBe("America/Los_Angeles");
    expect(normalizeZendeskTimeZone("Cairo")).toBe("Africa/Cairo");
    expect(normalizeZendeskTimeZone("London")).toBe("Europe/London");
    expect(normalizeZendeskTimeZone("Tokyo")).toBe("Asia/Tokyo");
    expect(normalizeZendeskTimeZone("Sydney")).toBe("Australia/Sydney");
    expect(normalizeZendeskTimeZone("UTC")).toBe("UTC");
  });

  it("passes through a value that's already a valid IANA id, unchanged", () => {
    expect(normalizeZendeskTimeZone("Africa/Cairo")).toBe("Africa/Cairo");
    expect(normalizeZendeskTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("every mapped IANA id is itself a value Intl actually resolves", () => {
    for (const zendeskName of ["Eastern Time (US & Canada)", "Cairo", "Kyiv", "Chennai", "Auckland"]) {
      const normalized = normalizeZendeskTimeZone(zendeskName);
      expect(normalized, zendeskName).not.toBeNull();
      expect(isValidTimeZone(normalized!), `${zendeskName} -> ${normalized}`).toBe(true);
    }
  });

  it("returns null for an unknown/unmapped value instead of guessing", () => {
    expect(normalizeZendeskTimeZone("Not A Real Zendesk Timezone")).toBeNull();
    expect(normalizeZendeskTimeZone("")).toBeNull();
  });
});
