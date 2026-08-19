/**
 * One sanitized invocation summary per producer Tail event.
 * Never forwards raw headers, query strings, bodies, or console payloads.
 */
import {
  eventOutcomeFromStatus,
  routeTemplate,
  sanitizeFields,
  type EventOutcome,
  type Fields,
} from "@betterflag/observability";

export interface TailSummary extends Fields {
  "service.name": "betterflag-tail";
  "event.name": "workers.invocation";
  "event.outcome": EventOutcome;
  script: string;
  event_type: string;
  route?: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  colo?: string;
  exception_count: number;
  outcome: string;
}

interface TailRequestLike {
  url?: string;
  method?: string;
  cf?: { colo?: string };
}

interface TailEventLike {
  request?: TailRequestLike;
  response?: { status?: number };
  cron?: string;
  queue?: string;
  scheduledTime?: number;
  type?: string;
}

export interface TailItemLike {
  scriptName?: string | null;
  outcome?: string;
  eventTimestamp?: number;
  wallTime?: number;
  cpuTime?: number;
  event?: TailEventLike | null;
  logs?: Array<{ message?: unknown[]; timestamp?: number; level?: string }>;
  exceptions?: unknown[];
}

function eventTypeOf(item: TailItemLike): string {
  const event = item.event;
  if (!event) return "unknown";
  if (event.request) return "fetch";
  if (event.queue) return "queue";
  if (event.cron || event.scheduledTime !== undefined) return "scheduled";
  if (typeof event.type === "string" && event.type.length > 0) return event.type;
  return "other";
}

function parseJsonLog(message: unknown): Record<string, unknown> | null {
  const text = Array.isArray(message) ? message.map(String).join(" ") : String(message ?? "");
  const start = text.indexOf("{");
  if (start === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(start)) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Producer console line was not JSON.
  }
  return null;
}

function durationFromLogs(item: TailItemLike): number | undefined {
  for (const log of item.logs ?? []) {
    const parsed = parseJsonLog(log.message);
    const value = parsed?.["duration_ms"];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function statusFromLogs(item: TailItemLike): number | undefined {
  for (const log of item.logs ?? []) {
    const parsed = parseJsonLog(log.message);
    const value = parsed?.["status"];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function outcomeOf(item: TailItemLike, status?: number): EventOutcome {
  if (item.outcome && item.outcome !== "ok" && item.outcome !== "canceled") return "error";
  if ((item.exceptions?.length ?? 0) > 0) return "error";
  if (status !== undefined) return eventOutcomeFromStatus(status);
  return item.outcome === "ok" ? "ok" : "error";
}

export function summarizeTailItem(item: TailItemLike): TailSummary {
  const event = item.event ?? undefined;
  const request = event?.request;
  let route: string | undefined;
  if (typeof request?.url === "string") {
    try {
      route = routeTemplate(new URL(request.url).pathname);
    } catch {
      route = undefined;
    }
  } else if (typeof event?.queue === "string") {
    route = event.queue;
  } else if (typeof event?.cron === "string") {
    route = event.cron;
  }

  const status = event?.response?.status ?? statusFromLogs(item);
  const duration = typeof item.wallTime === "number" ? item.wallTime : durationFromLogs(item);

  const summary: TailSummary = {
    "service.name": "betterflag-tail",
    "event.name": "workers.invocation",
    "event.outcome": outcomeOf(item, status),
    script: item.scriptName ?? "unknown",
    event_type: eventTypeOf(item),
    exception_count: item.exceptions?.length ?? 0,
    outcome: item.outcome ?? "unknown",
  };
  if (route) summary.route = route;
  if (request?.method) summary.method = request.method;
  if (status !== undefined) summary.status = status;
  if (duration !== undefined) summary.duration_ms = duration;
  if (request?.cf?.colo) summary.colo = request.cf.colo;
  return sanitizeFields(summary) as TailSummary;
}
