/**
 * ShipOS edge worker — flag evaluation at the edge (edge.shipos.app).
 *
 * Hot-path budget (p50 < 10 ms): one KV read for the SDK key, one KV read
 * for the snapshot, nothing else. Evaluation events are fire-and-forget via
 * `ctx.waitUntil` and must never block or fail the response.
 *
 * All evaluation logic lives in `@shipos/core` — this worker only does
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
import { z } from "zod";

// ---------------------------------------------------------------------------
// Environment (structural types so tests can pass plain fakes — no miniflare)
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
}

/** The slice of ExecutionContext this worker uses. */
export interface WaitUntilLike {
  waitUntil(promise: Promise<unknown>): void;
}

// ---------------------------------------------------------------------------
// Schemas (zod at every boundary)
// ---------------------------------------------------------------------------

/** KV value at `key:{prefix}` — see CONTRACTS.md "API keys". */
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
// Auth — resolve the presented SDK key from KV, verify hash, reject revoked
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
    // Corrupt snapshot fails open to not_found/defaults — never a 500.
    console.error(`invalid snapshot in KV for ${projectId}/${envSlug}: ${parsed.error.message}`);
    return null;
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Events — fire-and-forget, chunked ≤100 per sendBatch
// ---------------------------------------------------------------------------

export const EVENTS_CHUNK_SIZE = 100;

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
): Promise<Response> {
  const auth = await authenticateSdkKey(request, env.CONFIG_KV);
  if (!auth.ok) return auth.response;
  const { entry } = auth;

  let rawBody: unknown = {};
  const text = await request.text();
  if (text.trim() !== "") {
    try {
      rawBody = JSON.parse(text);
    } catch {
      return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
    }
  }
  const parsedBody = evaluateBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return errorResponse(400, "invalid_request", parsedBody.error.message);
  }
  const body = parsedBody.data;
  if (body.key !== undefined && body.keys !== undefined) {
    return errorResponse(400, "invalid_request", "Provide `key` or `keys`, not both.");
  }
  const context: EvaluationContext = body.context ?? {};
  const requestedKeys = body.key !== undefined ? [body.key] : body.keys;

  const snapshot = await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug);

  let version: number;
  let results: EvaluationResult[];
  if (snapshot === null) {
    // Missing snapshot: SDKs fall back to their defaults — never a 500.
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

  // Events must never block or fail the response.
  try {
    const sdk = request.headers.get("X-ShipOS-SDK") ?? "unknown";
    const events = buildEvents(entry, results, context, sdk);
    if (events.length > 0) {
      ctx.waitUntil(
        publishEvents(env.EVENTS, events).catch((error: unknown) => {
          console.error("failed to publish evaluation events", error);
        }),
      );
    }
  } catch (error) {
    console.error("failed to build evaluation events", error);
  }

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

export async function handleSnapshot(request: Request, env: EdgeEnv): Promise<Response> {
  const auth = await authenticateSdkKey(request, env.CONFIG_KV);
  if (!auth.ok) return auth.response;
  const { entry } = auth;

  const snapshot =
    (await loadSnapshot(env.CONFIG_KV, entry.projectId, entry.envSlug)) ?? emptySnapshot(entry);
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
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...PREFLIGHT_HEADERS } });
  }

  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/v1/evaluate") {
    return handleEvaluate(request, env, ctx);
  }
  if (request.method === "GET" && url.pathname === "/v1/snapshot") {
    return handleSnapshot(request, env);
  }

  return errorResponse(404, "not_found", `No route for ${request.method} ${url.pathname}`);
}

const handler = {
  async fetch(request, env, ctx): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<EdgeEnv>;

export default handler;
