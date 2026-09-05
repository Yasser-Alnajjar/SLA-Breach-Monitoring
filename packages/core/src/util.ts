/**
 * Deterministic (non-cryptographic) hash, used only to derive stable ids
 * from an Evaluation's own inputs — never `crypto.randomUUID()`, which
 * would break the reproducibility guarantee that the same inputs always
 * produce an identical output (Phase 13.8).
 */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
