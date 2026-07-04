import type { JsonValue } from "./types";

/**
 * Deterministic JSON serialization: object keys are emitted in sorted order
 * at every depth, so two structurally-equal values always produce the same
 * string. Used to build evaluation cache keys — `{a:1,b:2}` and `{b:2,a:1}`
 * must hit the same cache entry.
 *
 * `undefined` (only possible at the top level or as a skipped object
 * property) serializes to the empty string / is omitted, mirroring
 * `JSON.stringify` semantics.
 */
export function stableStringify(value: JsonValue | undefined): string {
  if (value === undefined) return "";
  return stringify(value);
}

function stringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) =>
      item === undefined ? "null" : stringify(item),
    );
    return `[${items.join(",")}]`;
  }
  const parts: string[] = [];
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${stringify(item)}`);
  }
  return `{${parts.join(",")}}`;
}
