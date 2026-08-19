/**
 * Shared telemetry schema + redaction. Every log field and span attribute
 * goes through `sanitizeFields` so secrets, PII, and unbounded payloads never
 * leave the process.
 */

export type Fields = Record<string, unknown>;

const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_KEYS = 40;

const BLOCKED_KEY =
  /^(authorization|cookie|set-cookie|token|secret|password|passwd|api[_-]?key|apikey|bearer|x-api-key|webhook-signature|svix-signature|raw_?body|body|headers|query|search|email|emails|user_?id|userId)$/i;

const SECRET_IN_STRING =
  /\b(bf_(?:sdk|agt|adm)_[A-Za-z0-9]+)|Bearer\s+\S+|sk_live_[A-Za-z0-9]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export type EventOutcome = "ok" | "client_error" | "error";

export function eventOutcomeFromStatus(status: number): EventOutcome {
  if (status >= 500) return "error";
  if (status >= 400) return "client_error";
  return "ok";
}

export function boundErrorText(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return redactString(text).slice(0, MAX_STRING);
}

export function redactString(value: string): string {
  return value.replace(SECRET_IN_STRING, "[redacted]").slice(0, MAX_STRING);
}

function isBlockedKey(key: string): boolean {
  return BLOCKED_KEY.test(key);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(value.stack ? { stack: redactString(value.stack) } : {}),
    };
  }
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeFields(value as Fields, depth + 1);
  }
  return redactString(String(value));
}

/** Drop blocked keys, redact secrets in strings, bound size. */
export function sanitizeFields(fields: Fields, depth = 0): Fields {
  const out: Fields = {};
  let count = 0;
  for (const [key, value] of Object.entries(fields)) {
    if (count >= MAX_KEYS) break;
    if (isBlockedKey(key)) continue;
    if (value === undefined) continue;
    const next = sanitizeValue(value, depth);
    if (next === undefined) continue;
    out[key] = next;
    count += 1;
  }
  return out;
}

export function routeTemplate(pathname: string): string {
  return pathname
    .split("/")
    .map((part) => {
      if (part === "") return part;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
        return ":id";
      }
      if (/^[0-9a-f]{16,}$/i.test(part)) return ":id";
      if (/^\d+$/.test(part)) return ":id";
      return part;
    })
    .join("/");
}

export const ALLOWED_BUSINESS_KEYS = [
  "org_id",
  "project_id",
  "environment_id",
  "env",
  "flag_key",
  "request_id",
  "status",
  "duration_ms",
  "key_kind",
  "key_prefix",
  "event.name",
  "event.outcome",
  "tool_name",
  "queue",
  "cron",
] as const;
