/**
 * Betterflag API worker, flag evaluation at the edge (api.betterflag.app).
 *
 * Hot-path budget (p50 < 10 ms): one KV read for the SDK key, one KV read
 * for the snapshot, nothing else. Evaluation events are fire-and-forget
 * (Queues via `ctx.waitUntil`, plus an Analytics Engine dual-write while
 * ANALYTICS_AE_ENABLED is set, see ITR-62) and must never block or fail
 * the response.
 *
 * All evaluation logic lives in `@betterflag/core`, this worker only does
 * routing, auth, and transport. See docs/CONTRACTS.md.
 */
import {
  evaluateAll,
  evaluateFlag,
  evaluateSnapshot,
  evaluationContextSchema,
  hashUserId,
  isSdkKeyThrottled,
  keyPrefixOf,
  kindOfKey,
  projectSnapshotSchema,
  sdkKeyKvKey,
  sha256Hex,
  snapshotKvKey,
  timingSafeEqualHex,
} from "@betterflag/core";
import type {
  EvaluationContext,
  EvaluationEvent,
  EvaluationResult,
  ProjectSnapshot,
  SdkKeyKvEntry,
} from "@betterflag/core";
import {
  attachWorkerTracing,
  eventOutcomeFromStatus,
  formatRelease,
  readObservability,
  routeTemplate,
  type Logger,
  type Observability,
  type Span,
} from "@betterflag/observability";
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

/** The slice of an Analytics Engine dataset binding this worker uses. */
export interface EvalsDatasetLike {
  writeDataPoint(point: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
}

export interface EdgeEnv {
  CONFIG_KV: ConfigKvLike;
  EVENTS: EventsQueueLike;
  /**
   * Workers Analytics Engine dataset `betterflag_evaluations` (ITR-62). Optional
   * so unit tests can omit it and so the worker keeps serving if the binding
   * is ever removed.
   */
  EVALS?: EvalsDatasetLike;
  /**
   * "true"/"1" turns on the Analytics Engine dual-write (ITR-62 Phase 1,
   * shadow mode: ClickHouse via Queues stays the source of truth). Env var
   * for now; dogfood via a Betterflag flag once selfhosting works.
   */
  ANALYTICS_AE_ENABLED?: string;
  // Observability config, all optional so unit tests can pass plain fakes and
  // so the worker degrades to console-only logging when unset. Tokens are set
  // via `wrangler secret put`; endpoints via wrangler `vars`.
  BETTER_STACK_SOURCE_TOKEN?: string;
  BETTER_STACK_LOGS_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  BETTERFLAG_ENV?: string;
  /** Deploy-time git commit; appended to VERSION as the release. */
  BETTERFLAG_GIT_SHA?: string;
  /** Fully-formed release override (wins over VERSION + git sha) if set. */
  BETTERFLAG_RELEASE?: string;
}

/** The slice of ExecutionContext this worker uses. */
export interface WaitUntilLike {
  waitUntil(promise: Promise<unknown>): void;
  tracing?: import("@betterflag/observability").NativeTracing;
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
  // Optional: old entries omit these; missing quota/used = not throttled.
  plan: z.string().optional(),
  quota: z.number().int().nonnegative().nullable().optional(),
  used: z.number().int().nonnegative().optional(),
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
  "Access-Control-Allow-Headers": "authorization, content-type, x-betterflag-sdk",
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
    response: errorResponse(401, "invalid_key", "A valid bf_sdk_* bearer token is required."),
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
  log?: Logger,
): Promise<ProjectSnapshot | null> {
  // Cloudflare KV enforces a minimum cacheTtl of 60s; snapshot freshness is
  // driven by explicit KV.put on config change, not by TTL expiry.
  const raw = await kv.get(snapshotKvKey(projectId, envSlug), { type: "json", cacheTtl: 60 });
  if (raw === null || raw === undefined) return null;
  const parsed = projectSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    // Corrupt snapshot fails open to not_found/defaults, never a 500.
    log?.error("snapshot corrupt", {
      "event.name": "snapshot.corrupt",
      "event.outcome": "error",
      project_id: projectId,
      env: envSlug,
    });
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

/** Client geo from Cloudflare `request.cf` (country + region + city + coords). */
export type ClientGeo = {
  country: string;
  /** Region/state from `cf.region`; null when Cloudflare omits it. */
  region: string | null;
  /** City name from `cf.city`; null when Cloudflare omits it. */
  city: string | null;
  /** Rounded to ~1 km; null when Cloudflare omits coordinates. */
  lat: number | null;
  lng: number | null;
};

/** Round cf coordinates to 2 decimal places (~1.1 km) before enqueue. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function trimCfString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Country, region, city, and approximate coordinates of the calling client
 * from Cloudflare request metadata. Country is ISO 3166-1 alpha-2 ("unknown"
 * when missing). Region/city/lat/lng are null when Cloudflare omits them.
 */
export function clientGeoOf(request: Request): ClientGeo {
  const cf = (
    request as {
      cf?: {
        country?: unknown;
        region?: unknown;
        city?: unknown;
        latitude?: unknown;
        longitude?: unknown;
      };
    }
  ).cf;
  const rawCountry = cf?.country;
  const country =
    typeof rawCountry === "string" && rawCountry.length > 0
      ? rawCountry.toUpperCase()
      : "unknown";

  const region = trimCfString(cf?.region);
  const city = trimCfString(cf?.city);

  const latRaw = typeof cf?.latitude === "string" ? Number(cf.latitude) : NaN;
  const lngRaw = typeof cf?.longitude === "string" ? Number(cf.longitude) : NaN;
  if (
    Number.isFinite(latRaw) &&
    Number.isFinite(lngRaw) &&
    latRaw >= -90 &&
    latRaw <= 90 &&
    lngRaw >= -180 &&
    lngRaw <= 180
  ) {
    return { country, region, city, lat: roundCoord(latRaw), lng: roundCoord(lngRaw) };
  }
  return { country, region, city, lat: null, lng: null };
}

/** @deprecated Prefer `clientGeoOf`; kept for call sites that only need country. */
export function countryOf(request: Request): string {
  return clientGeoOf(request).country;
}

/**
 * Merge the Cloudflare-detected country into the evaluation context as a
 * fallback `country` attribute, so country targeting works without the SDK
 * sending it. Explicit context always wins: a server-side caller may pass
 * the *user's* country, which `cf.country` (the caller's own location, e.g.
 * an origin server's datacenter) cannot know. "unknown" is never injected.
 */
export function withCountryFallback(
  context: EvaluationContext,
  country: string,
): EvaluationContext {
  if (country === "unknown") return context;
  if (context.attributes?.country !== undefined) return context;
  return { ...context, attributes: { ...context.attributes, country } };
}

export function buildEvents(
  entry: SdkKeyKvEntry,
  results: readonly EvaluationResult[],
  context: EvaluationContext,
  sdk: string,
  geo: ClientGeo | string,
): EvaluationEvent[] {
  const resolved: ClientGeo =
    typeof geo === "string"
      ? { country: geo, region: null, city: null, lat: null, lng: null }
      : geo;
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
    country: resolved.country,
    region: resolved.region,
    city: resolved.city,
    lat: resolved.lat,
    lng: resolved.lng,
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
// Analytics Engine dual-write (ITR-62), one data point per evaluation
// ---------------------------------------------------------------------------

/** Platform limit: writeDataPoint calls per Worker invocation. */
export const AE_MAX_POINTS_PER_INVOCATION = 25;

/**
 * Sentinel flag_key for the rollup point emitted when a request evaluates
 * more flags than the writeDataPoint budget. Totals stay exact (billing);
 * per-flag series lose detail for the flags folded into the rollup.
 */
export const AE_ROLLUP_FLAG_KEY = "__rollup";

/**
 * Dataset point layout (see docs/CONTRACTS.md "Analytics Engine dataset"):
 * index1 = org_id (per-customer sampling fairness); blobs 1-8 = project_id,
 * env, flag_key, variation, reason, actor_kind, sdk, country; double1 =
 * user_hash (f64, lossy above 2^53, only used for approximate distincts),
 * double2 = count (sum with `_sample_interval` weighting at query time).
 */
export interface EvalDataPoint {
  indexes: [string];
  blobs: [string, string, string, string, string, string, string, string];
  doubles: [number, number];
}

function toDataPoint(event: EvaluationEvent, count: number): EvalDataPoint {
  return {
    indexes: [event.org_id],
    blobs: [
      event.project_id,
      event.env,
      event.flag_key,
      event.variation,
      event.reason,
      event.actor_kind,
      event.sdk,
      event.country,
    ],
    doubles: [Number(event.user_hash), count],
  };
}

/**
 * One detail point (count 1) per evaluation while the request fits the
 * 25-point budget. Beyond that: 24 detail points + one rollup carrying
 * `count = remaining` so sum(count) always equals the evaluation count.
 * Within one request every event shares org/project/env/sdk/country/actor,
 * so the rollup only collapses flag_key/variation/reason.
 */
export function buildDataPoints(events: readonly EvaluationEvent[]): EvalDataPoint[] {
  if (events.length <= AE_MAX_POINTS_PER_INVOCATION) {
    return events.map((event) => toDataPoint(event, 1));
  }
  const detail = events.slice(0, AE_MAX_POINTS_PER_INVOCATION - 1);
  // Non-empty: events.length > AE_MAX_POINTS_PER_INVOCATION here.
  const rest = events.slice(AE_MAX_POINTS_PER_INVOCATION - 1);
  const rollup = toDataPoint(
    { ...rest[0]!, flag_key: AE_ROLLUP_FLAG_KEY, variation: "", reason: "rollup" },
    rest.length,
  );
  return [...detail.map((event) => toDataPoint(event, 1)), rollup];
}

export function aeDualWriteEnabled(env: Pick<EdgeEnv, "EVALS" | "ANALYTICS_AE_ENABLED">): boolean {
  return (
    env.EVALS !== undefined &&
    (env.ANALYTICS_AE_ENABLED === "true" || env.ANALYTICS_AE_ENABLED === "1")
  );
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
    "betterflag.org_id": entry.orgId,
    "betterflag.project_id": entry.projectId,
    "betterflag.env": entry.envSlug,
  });

  if (isSdkKeyThrottled(entry)) {
    obs?.log.warn("evaluate: starter quota exceeded", { status: 429 });
    return jsonResponse(
      429,
      {
        error: {
          code: "quota_exceeded",
          message: "Starter plan evaluation quota exceeded. Retry later this month, or upgrade.",
        },
      },
      { "Retry-After": "3600" },
    );
  }

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
  const context: EvaluationContext = withCountryFallback(
    body.context ?? {},
    countryOf(request),
  );
  const requestedKeys = body.key !== undefined ? [body.key] : body.keys;

  const snapSpan = obs?.span.startChild("load_snapshot");
  const snapshot = await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug, obs?.log);
  snapSpan?.setAttribute("snapshot.hit", snapshot !== null);
  if (snapshot !== null) snapSpan?.setAttribute("snapshot.version", snapshot.version);
  snapSpan?.end();

  const evalSpan = obs?.span.startChild("evaluate");
  let version: number;
  let results: EvaluationResult[];
  if (snapshot === null) {
    // Missing snapshot: SDKs fall back to their defaults, never a 500.
    obs?.log.warn("evaluate: snapshot miss, returning SDK defaults", {
      "event.name": "snapshot.miss",
      "event.outcome": "client_error",
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
    const sdk = request.headers.get("X-Betterflag-SDK") ?? "unknown";
    const events = buildEvents(entry, results, context, sdk, clientGeoOf(request));
    if (events.length > 0) {
      // ITR-62 dual-write: Analytics Engine alongside the Queues path.
      // writeDataPoint is synchronous fire-and-forget; its own try so an AE
      // failure can never take down the queue publish or the response.
      if (aeDualWriteEnabled(env)) {
        const aeSpan = obs?.span.startChild("analytics_engine.write");
        try {
          const points = buildDataPoints(events);
          for (const point of points) env.EVALS?.writeDataPoint(point);
          aeSpan?.setAttribute("ae.points", points.length).end();
        } catch (error) {
          aeSpan?.recordException(error).end();
          obs?.log.error("failed to write AE data points", {
            "event.name": "ae.write",
            "event.outcome": "error",
            error: errText(error),
          });
        }
      }
      const queueSpan = obs?.span.startChild("queue.publish");
      ctx.waitUntil(
        publishEvents(env.EVENTS, events)
          .then(() => {
            queueSpan?.setAttribute("event_count", events.length).end();
          })
          .catch((error: unknown) => {
            queueSpan?.recordException(error).end();
            obs?.log.error("failed to publish evaluation events", {
              "event.name": "queue.publish",
              "event.outcome": "error",
              error: errText(error),
              event_count: events.length,
            });
          })
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
    "betterflag.org_id": entry.orgId,
    "betterflag.project_id": entry.projectId,
    "betterflag.env": entry.envSlug,
  });

  const snapSpan = obs?.span.startChild("load_snapshot");
  const loaded = await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug, obs?.log);
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

    attachWorkerTracing(ctx);
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-api", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.BETTERFLAG_GIT_SHA, override: env.BETTERFLAG_RELEASE }),
      runtime: "worker",
    });
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
    const route = routeTemplate(url.pathname);
    const span = obs.tracer.startSpan(`${request.method} ${route}`, {
      kind: "server",
      attributes: {
        "http.request.method": request.method,
        "http.route": route,
        "url.path": route,
        "request.id": requestId,
        "event.name": `${request.method} ${route}`,
      },
    });
    const log = obs.logger.child({ request_id: requestId, method: request.method, path: route, ...span.logContext });
    const edgeObs: EdgeObs = { obs, log, span };

    let response: Response;
    try {
      response = await handleRequest(request, env, ctx, edgeObs);
    } catch (error) {
      // Defensive: the hot path is designed never to throw, but if it does we
      // return a clean 500 and record it rather than leaking a Worker crash.
      span.recordException(error).setAttribute("http.response.status_code", 500).end();
      log.error("unhandled error in API worker", { status: 500, error: errText(error) });
      obs.flushTo(ctx.waitUntil.bind(ctx));
      return errorResponse(500, "internal_error", "Something went wrong");
    }

    span.setAttribute("http.response.status_code", response.status);
    if (response.status >= 500) span.setStatus("error");
    span.end();

    const durationMs = Math.round(span.durationMs() * 1000) / 1000;
    const isError = response.status >= 400;
    if (isError || Math.random() < EDGE_LOG_SUCCESS_SAMPLE_RATE) {
      const fields = {
        status: response.status,
        duration_ms: durationMs,
        "event.name": `${request.method} ${route}`,
        "event.outcome": eventOutcomeFromStatus(response.status),
      };
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
