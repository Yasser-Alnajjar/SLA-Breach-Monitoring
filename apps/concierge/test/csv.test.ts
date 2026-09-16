import { describe, expect, it } from "vitest";
import { Columns, DropCounter, MissingColumnError, parseCsv, requireColumns } from "../src/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and a BOM", () => {
    const table = parseCsv('﻿Id,Subject\r\n1,"Says ""hi"", twice"\r\n2,"line one\nline two"\r\n');
    expect(table.header).toEqual(["Id", "Subject"]);
    expect(table.rows).toEqual([
      ["1", 'Says "hi", twice'],
      ["2", "line one\nline two"],
    ]);
  });

  it("skips blank lines and keeps a last row with no trailing newline", () => {
    const table = parseCsv("a,b\n\n1,2\n,\n3,4");
    expect(table.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("Columns", () => {
  it("matches aliases ignoring case and punctuation, first non-empty value wins", () => {
    const columns = new Columns(["Ticket_ID", "Created At"]);
    expect(columns.get(["7", "2026-09-01"], ["ticket id"])).toBe("7");
    expect(columns.get(["7", " "], ["created at"])).toBeUndefined();
  });

  it("collects every value from repeated columns", () => {
    const columns = new Columns(["Key", "Remote Link", "Remote Link"]);
    expect(columns.getAll(["A-1", "x", "y"], ["remote link"])).toEqual(["x", "y"]);
  });

  it("names the accepted aliases when a required column is missing", () => {
    expect(() => requireColumns("tickets", parseCsv("Subject\nx"), { id: ["id", "ticket id"] })).toThrow(MissingColumnError);
    expect(() => requireColumns("tickets", parseCsv("Subject\nx"), { id: ["id", "ticket id"] })).toThrow(/id, ticket id/);
  });
});

describe("DropCounter", () => {
  it("counts per reason", () => {
    const drops = new DropCounter();
    drops.add("a");
    drops.add("a");
    drops.add("b");
    expect(drops.total).toBe(3);
    expect(drops.byReason.get("a")).toBe(2);
  });
});
