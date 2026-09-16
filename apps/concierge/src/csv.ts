/**
 * RFC 4180 CSV reading plus lenient header lookup. Prospect exports come
 * from Zendesk, Jira, Explore reports, or a spreadsheet someone re-saved, so
 * column names vary in case, spacing and punctuation. Columns are matched on a
 * normalized key against a list of aliases, never by position.
 */

export interface CsvTable {
  header: string[];
  rows: string[][];
}

/** Parses CSV text: quoted fields, escaped quotes, newlines inside quotes, CRLF, and a leading BOM. */
export function parseCsv(text: string): CsvTable {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonBlank = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  const [header = [], ...rows] = nonBlank;
  return { header: header.map((h) => h.trim()), rows };
}

export function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Column accessor for one table. `get` returns the first non-empty value
 * across every column matching any alias, in alias order; `getAll` returns
 * every non-empty value, since Jira repeats a column name once per value
 * for multi-value fields (e.g. several "Remote Link" columns).
 */
export class Columns {
  private readonly indicesByKey = new Map<string, number[]>();

  constructor(header: string[]) {
    header.forEach((name, index) => {
      const key = normalizeHeader(name);
      const existing = this.indicesByKey.get(key);
      if (existing) existing.push(index);
      else this.indicesByKey.set(key, [index]);
    });
  }

  private indices(aliases: readonly string[]): number[] {
    return aliases.flatMap((alias) => this.indicesByKey.get(normalizeHeader(alias)) ?? []);
  }

  has(aliases: readonly string[]): boolean {
    return this.indices(aliases).length > 0;
  }

  get(row: string[], aliases: readonly string[]): string | undefined {
    for (const index of this.indices(aliases)) {
      const value = row[index]?.trim();
      if (value) return value;
    }
    return undefined;
  }

  getAll(row: string[], aliases: readonly string[]): string[] {
    return this.indices(aliases)
      .map((index) => row[index]?.trim() ?? "")
      .filter((value) => value !== "");
  }
}

export class MissingColumnError extends Error {
  constructor(file: string, column: string, aliases: readonly string[], header: string[]) {
    super(
      `${file}: no "${column}" column. Accepted names: ${aliases.join(", ")}. Found: ${header.join(", ") || "(empty header)"}`,
    );
    this.name = "MissingColumnError";
  }
}

export function requireColumns(
  file: string,
  table: CsvTable,
  required: Record<string, readonly string[]>,
): Columns {
  const columns = new Columns(table.header);
  for (const [column, aliases] of Object.entries(required)) {
    if (!columns.has(aliases)) throw new MissingColumnError(file, column, aliases, table.header);
  }
  return columns;
}

/** Row-level drops, counted per reason instead of guessed at or silently skipped. */
export class DropCounter {
  readonly byReason = new Map<string, number>();

  add(reason: string): void {
    this.byReason.set(reason, (this.byReason.get(reason) ?? 0) + 1);
  }

  get total(): number {
    let sum = 0;
    for (const count of this.byReason.values()) sum += count;
    return sum;
  }
}
