/** Quotes a field per RFC 4180 only when it contains a comma, quote, or line break. */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Builds a CRLF-terminated CSV string, header row first. */
export function buildCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((row) => row.map((cell) => escapeField(String(cell ?? ""))).join(","));
  return lines.join("\r\n") + "\r\n";
}
