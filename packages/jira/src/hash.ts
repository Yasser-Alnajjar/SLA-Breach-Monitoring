import { createHash } from "node:crypto";

/**
 * Stable content hash for a JSON-serializable payload. Keys are sorted
 * recursively so field-order differences from the API never register as a
 * change. Used to dedupe re-fetches of unchanged records at the database's
 * unique index, per RawEvent's (integrationId, providerEventId) constraint.
 */
export function computeSourceHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
