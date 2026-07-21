/**
 * Merge-tag substitution for editable templates. Pure and dependency-free so
 * the Cloudflare Workers that send email can import it without pulling in React
 * or the render pipeline. Tags look like `{{orgName}}` (optional inner spaces).
 */

const TAG = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Distinct variable names referenced by a string, in first-seen order. */
export function extractVars(input: string): string[] {
  const seen = new Set<string>();
  for (const match of input.matchAll(TAG)) {
    const name = match[1];
    if (name) seen.add(name);
  }
  return [...seen];
}

export interface ApplyVarsOptions {
  /** HTML-escape substituted values (default true; use false for plain text). */
  escape?: boolean;
  /** What to render for a variable with no provided value (default ""). */
  fallback?: (name: string) => string;
}

/** Replace every `{{name}}` in `input` with `values[name]`. */
export function applyVars(
  input: string,
  values: Record<string, string | number | null | undefined>,
  options: ApplyVarsOptions = {},
): string {
  const escape = options.escape ?? true;
  return input.replace(TAG, (_all, name: string) => {
    const raw = values[name];
    if (raw === undefined || raw === null) {
      return options.fallback ? options.fallback(name) : "";
    }
    const str = String(raw);
    return escape ? escapeHtml(str) : str;
  });
}
