/**
 * ShipOS edge worker, flag evaluation at the edge (edge.shipos.app).
 *
 * Hot-path budget (p50 < 10 ms): one KV read for the SDK key, one KV read
 * for the snapshot, nothing else. Evaluation events are fire-and-forget via
 * `ctx.waitUntil` and must never block or fail the response.
 *
 * All evaluation logic lives in `@shipos/core`, this worker only does
 * routing, auth, and transport. See docs/CONTRACTS.md.
 */
import {
  evaluateAll,
  evaluateFlag,
  evaluateSnapshot,
  evaluationContextSchema,
  hashUserId,
  keyPrefixOf,
  kindOfKey,
  projectSnapshotSchema,
  sdkKeyKvKey,
  sha256Hex,
  snapshotKvKey,
  timingSafeEqualHex,
} from "@shipos/core";
import type {
  EvaluationContext,
  EvaluationEvent,
  EvaluationResult,
  ProjectSnapshot,
  SdkKeyKvEntry,
} from "@shipos/core";
import { formatRelease, readObservability, type Logger, type Observability, type Span } from "@shipos/observability";
import { VERSION } from "./version.gen";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Environment (structural types so tests can pass plain fakes, no miniflare)
// ---------------------------------------------------------------------------

/** The slice of a KVNamespace this worker uses. */
export interface ConfigKvLike {
  get(key: string, options: { type: "json"; cacheTtl?: number }): Promise<unknown>;
}

/** The slice of a Queue producer binding this worker uses. */
export interface EventsQueueLike {
  sendBatch(messages: Iterable<{ body: EvaluationEvent }>): Promise<void>;
}

export interface EdgeEnv {
  CONFIG_KV: ConfigKvLike;
  EVENTS: EventsQueueLike;
  // Observability config, all optional so unit tests can pass plain fakes and
  // so the worker degrades to console-only logging when unset. Tokens are set
  // via `wrangler secret put`; endpoints via wrangler `vars`.
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  SHIPOS_ENV?: string;
  /** Deploy-time git commit; appended to VERSION as the release. */
  SHIPOS_GIT_SHA?: string;
  /** Fully-formed release override (wins over VERSION + git sha) if set. */
  SHIPOS_RELEASE?: string;
}

/** The slice of ExecutionContext this worker uses. */
export interface WaitUntilLike {
  waitUntil(promise: Promise<unknown>): void;
}

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

/**
 * Fraction of *successful* (<400) requests to log, 0..1. Set to 1 to log every
 * request; lower it if edge log volume/cost becomes a concern. Errors (>=400)
 * and anomalies are ALWAYS logged regardless of this rate.
 */
export const EDGE_LOG_SUCCESS_SAMPLE_RATE = 1;

/** Per-request observability handles threaded (optionally) through the hot path. */
export interface EdgeObs {
  obs: Observability;
  log: Logger;
  span: Span;
}

/** Human-readable one-liner for an unknown thrown value. */
function errText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// ---------------------------------------------------------------------------
// Schemas (zod at every boundary)
// ---------------------------------------------------------------------------

/** KV value at `key:{prefix}`, see CONTRACTS.md "API keys". */
export const sdkKeyKvEntrySchema = z.object({
  orgId: z.string(),
  projectId: z.string(),
  envSlug: z.string(),
  hash: z.string(),
  revoked: z.boolean(),
}) satisfies z.ZodType<SdkKeyKvEntry>;

/** POST /v1/evaluate request body. One of key/keys, or neither = all flags. */
export const evaluateBodySchema = z.object({
  key: z.string().min(1).optional(),
  keys: z.array(z.string().min(1)).optional(),
  context: evaluationContextSchema.optional(),
});

// ---------------------------------------------------------------------------
// Response helpers (every response carries Access-Control-Allow-Origin: *)
// ---------------------------------------------------------------------------

const PREFLIGHT_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-shipos-sdk",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

// ---------------------------------------------------------------------------
// Auth, resolve the presented SDK key from KV, verify hash, reject revoked
// ---------------------------------------------------------------------------

export type AuthResult =
  | { ok: true; entry: SdkKeyKvEntry }
  | { ok: false; response: Response };

function unauthorized(): { ok: false; response: Response } {
  return {
    ok: false,
    response: errorResponse(401, "invalid_key", "A valid sos_sdk_* bearer token is required."),
  };
}

export async function authenticateSdkKey(
  request: Request,
  kv: ConfigKvLike,
): Promise<AuthResult> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (token === "" || kindOfKey(token) !== "sdk") return unauthorized();

  const raw = await kv.get(sdkKeyKvKey(keyPrefixOf(token)), { type: "json", cacheTtl: 60 });
  const parsed = sdkKeyKvEntrySchema.safeParse(raw);
  if (!parsed.success) return unauthorized();

  const entry = parsed.data;
  const presentedHash = await sha256Hex(token);
  if (!timingSafeEqualHex(presentedHash, entry.hash)) return unauthorized();
  if (entry.revoked) return unauthorized();

  return { ok: true, entry };
}

// ---------------------------------------------------------------------------
// Snapshot loading
// ---------------------------------------------------------------------------

export async function loadSnapshot(
  kv: ConfigKvLike,
  projectId: string,
  envSlug: string,
): Promise<ProjectSnapshot | null> {
  // Cloudflare KV enforces a minimum cacheTtl of 60s; snapshot freshness is
  // driven by explicit KV.put on config change, not by TTL expiry.
  const raw = await kv.get(snapshotKvKey(projectId, envSlug), { type: "json", cacheTtl: 60 });
  if (raw === null || raw === undefined) return null;
  const parsed = projectSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    // Corrupt snapshot fails open to not_found/defaults, never a 500.
    console.error(`invalid snapshot in KV for ${projectId}/${envSlug}: ${parsed.error.message}`);
    return null;
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Events, fire-and-forget, chunked ≤100 per sendBatch
// ---------------------------------------------------------------------------

const EVENTS_CHUNK_SIZE = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function buildEvents(
  entry: SdkKeyKvEntry,
  results: readonly EvaluationResult[],
  context: EvaluationContext,
  sdk: string,
): EvaluationEvent[] {
  const ts = new Date().toISOString();
  const user_hash = context.userId !== undefined ? hashUserId(context.userId) : "0";
  return results.map((result) => ({
    ts,
    org_id: entry.orgId,
    project_id: entry.projectId,
    env: entry.envSlug,
    flag_key: result.key,
    variation: result.variation,
    reason: result.reason,
    actor_kind: "sdk" as const,
    sdk,
    user_hash,
  }));
}

export async function publishEvents(
  queue: EventsQueueLike,
  events: readonly EvaluationEvent[],
): Promise<void> {
  for (const batch of chunk(events, EVENTS_CHUNK_SIZE)) {
    await queue.sendBatch(batch.map((body) => ({ body })));
  }
}

// ---------------------------------------------------------------------------
// POST /v1/evaluate
// ---------------------------------------------------------------------------

export async function handleEvaluate(
  request: Request,
  env: EdgeEnv,
  ctx: WaitUntilLike,
  obs?: EdgeObs,
): Promise<Response> {
  const authSpan = obs?.span.startChild("authenticate");
  const auth = await authenticateSdkKey(request, env.CONFIG_KV);
  authSpan?.setAttribute("auth.ok", auth.ok).end();
  if (!auth.ok) {
    obs?.log.warn("evaluate: unauthorized", { status: 401 });
    return auth.response;
  }
  const { entry } = auth;
  obs?.span.setAttributes({
    "shipos.org_id": entry.orgId,
    "shipos.project_id": entry.projectId,
    "shipos.env": entry.envSlug,
  });

  let rawBody: unknown = {};
  const text = await request.text();
  if (text.trim() !== "") {
    try {
      rawBody = JSON.parse(text);
    } catch {
      obs?.log.warn("evaluate: body is not valid JSON", { status: 400 });
      return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
    }
  }
  const parsedBody = evaluateBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    obs?.log.warn("evaluate: invalid request body", { status: 400, detail: parsedBody.error.message });
    return errorResponse(400, "invalid_request", parsedBody.error.message);
  }
  const body = parsedBody.data;
  if (body.key !== undefined && body.keys !== undefined) {
    obs?.log.warn("evaluate: both key and keys provided", { status: 400 });
    return errorResponse(400, "invalid_request", "Provide `key` or `keys`, not both.");
  }
  const context: EvaluationContext = body.context ?? {};
  const requestedKeys = body.key !== undefined ? [body.key] : body.keys;

  const snapSpan = obs?.span.startChild("load_snapshot");
  const snapshot = await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug);
  snapSpan?.setAttribute("snapshot.hit", snapshot !== null);
  if (snapshot !== null) snapSpan?.setAttribute("snapshot.version", snapshot.version);
  snapSpan?.end();

  const evalSpan = obs?.span.startChild("evaluate");
  let version: number;
  let results: EvaluationResult[];
  if (snapshot === null) {
    // Missing snapshot: SDKs fall back to their defaults, never a 500.
    obs?.log.warn("evaluate: snapshot miss, returning SDK defaults", {
      project_id: entry.projectId,
      env: entry.envSlug,
    });
    version = 0;
    results =
      requestedKeys === undefined
        ? []
        : requestedKeys.map((key) => evaluateFlag(key, undefined, context));
  } else {
    version = snapshot.version;
    results =
      requestedKeys === undefined
        ? evaluateAll(snapshot, context)
        : evaluateSnapshot(snapshot, requestedKeys, context);
  }
  evalSpan?.setAttributes({ "evaluation.count": results.length, "snapshot.version": version }).end();

  // Events must never block or fail the response.
  try {
    const sdk = request.headers.get("X-ShipOS-SDK") ?? "unknown";
    const events = buildEvents(entry, results, context, sdk);
    if (events.length > 0) {
      ctx.waitUntil(
        publishEvents(env.EVENTS, events)
          .catch((error: unknown) => {
            console.error("failed to publish evaluation events", error);
            obs?.log.error("failed to publish evaluation events", {
              error: errText(error),
              event_count: events.length,
            });
          })
          // Flush the (possibly late) failure log without blocking the response.
          .finally(() => (obs ? obs.obs.flush() : undefined)),
      );
    }
  } catch (error) {
    console.error("failed to build evaluation events", error);
    obs?.log.error("failed to build evaluation events", { error: errText(error) });
  }

  obs?.span.setAttribute("evaluation.count", results.length);
  return jsonResponse(200, { version, results });
}

// ---------------------------------------------------------------------------
// GET /v1/snapshot
// ---------------------------------------------------------------------------

function emptySnapshot(entry: SdkKeyKvEntry): ProjectSnapshot {
  return {
    version: 0,
    projectId: entry.projectId,
    environment: entry.envSlug,
    generatedAt: new Date().toISOString(),
    flags: {},
  };
}

function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) return false;
  return ifNoneMatch.split(",").some((candidate) => candidate.trim() === etag);
}

export async function handleSnapshot(
  request: Request,
  env: EdgeEnv,
  obs?: EdgeObs,
): Promise<Response> {
  const authSpan = obs?.span.startChild("authenticate");
  const auth = await authenticateSdkKey(request, env.CONFIG_KV);
  authSpan?.setAttribute("auth.ok", auth.ok).end();
  if (!auth.ok) {
    obs?.log.warn("snapshot: unauthorized", { status: 401 });
    return auth.response;
  }
  const { entry } = auth;
  obs?.span.setAttributes({
    "shipos.org_id": entry.orgId,
    "shipos.project_id": entry.projectId,
    "shipos.env": entry.envSlug,
  });

  const snapSpan = obs?.span.startChild("load_snapshot");
  const loaded = await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug);
  snapSpan?.setAttribute("snapshot.hit", loaded !== null).end();
  const snapshot = loaded ?? emptySnapshot(entry);
  const etag = `"v${snapshot.version}"`;

  if (etagMatches(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    });
  }

  return jsonResponse(200, snapshot, { ETag: etag, "Cache-Control": "no-cache" });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handleRequest(
  request: Request,
  env: EdgeEnv,
  ctx: WaitUntilLike,
  obs?: EdgeObs,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...PREFLIGHT_HEADERS } });
  }

  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/v1/evaluate") {
    return handleEvaluate(request, env, ctx, obs);
  }
  if (request.method === "GET" && url.pathname === "/v1/snapshot") {
    return handleSnapshot(request, env, obs);
  }

  return errorResponse(404, "not_found", `No route for ${request.method} ${url.pathname}`);
}

const handler = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    // CORS preflight is hot and uninteresting, answer it without telemetry.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...PREFLIGHT_HEADERS } });
    }

    const obs = readObservability(env as unknown as Record<string, unknown>, "shipos-edge", {
      environment: env.SHIPOS_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.SHIPOS_GIT_SHA, override: env.SHIPOS_RELEASE }),
    });
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
    const span = obs.tracer.startSpan(`${request.method} ${url.pathname}`, {
      kind: "server",
      attributes: {
        "http.request.method": request.method,
        "url.path": url.pathname,
        "request.id": requestId,
        "user_agent.original": request.headers.get("user-agent") ?? undefined,
      },
    });
    const log = obs.logger.child({ request_id: requestId, method: request.method, path: url.pathname, ...span.logContext });
    const edgeObs: EdgeObs = { obs, log, span };

    let response: Response;
    try {
      response = await handleRequest(request, env, ctx, edgeObs);
    } catch (error) {
      // Defensive: the hot path is designed never to throw, but if it does we
      // return a clean 500 and record it rather than leaking a Worker crash.
      span.recordException(error).setAttribute("http.response.status_code", 500).end();
      log.error("unhandled error in edge worker", { status: 500, error: errText(error) });
      obs.flushTo(ctx.waitUntil.bind(ctx));
      return errorResponse(500, "internal_error", "Something went wrong");
    }

    span.setAttribute("http.response.status_code", response.status);
    if (response.status >= 500) span.setStatus("error");
    span.end();

    const durationMs = Math.round(span.durationMs() * 1000) / 1000;
    const isError = response.status >= 400;
    if (isError || Math.random() < EDGE_LOG_SUCCESS_SAMPLE_RATE) {
      const fields = { status: response.status, duration_ms: durationMs };
      if (response.status >= 500) log.error("request", fields);
      else if (response.status >= 400) log.warn("request", fields);
      else log.info("request", fields);
    }

    // Ship logs + spans after the response is sent, never blocks the hot path.
    obs.flushTo(ctx.waitUntil.bind(ctx));
    return response;
  },
} satisfies ExportedHandler<EdgeEnv>;

export default handler;
