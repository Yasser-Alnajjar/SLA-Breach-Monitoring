import { describe, expect, it } from "vitest";
import { extractIssueIdentifiers } from "../src/correlate";

describe("extractIssueIdentifiers", () => {
  it("extracts a Jira/Linear-shaped identifier from a PR title", () => {
    expect(extractIssueIdentifiers("Fix login bug (ENG-456)")).toEqual(["ENG-456"]);
  });

  it("extracts an identifier from a lowercase branch name, uppercasing to the canonical form", () => {
    expect(extractIssueIdentifiers("eng-456-fix-login-bug")).toEqual(["ENG-456"]);
  });

  it("extracts multiple distinct identifiers referenced in the same text", () => {
    expect(extractIssueIdentifiers("Fixes ENG-1 and PROJ-2")).toEqual(["ENG-1", "PROJ-2"]);
  });

  it("de-duplicates repeated identifiers", () => {
    expect(extractIssueIdentifiers("ENG-456: see ENG-456 for context")).toEqual(["ENG-456"]);
  });

  it("returns an empty array when no identifier-shaped text is present", () => {
    expect(extractIssueIdentifiers("Fix the login bug")).toEqual([]);
  });

  it("does not match a bare number with no team key", () => {
    expect(extractIssueIdentifiers("Fixes #456")).toEqual([]);
  });

  it("does not match a bare commit SHA with no dash-number suffix", () => {
    expect(extractIssueIdentifiers("bump vendored dep to a1b2c3d4")).toEqual([]);
  });
});
