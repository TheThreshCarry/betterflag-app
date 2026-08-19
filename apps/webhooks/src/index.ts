/**
 * Betterflag webhooks worker, receives Polar billing webhooks and syncs each
 * subscription's state onto its org.
 *
 * Flow:
 *   1. Verify the Standard Webhooks signature (HMAC-SHA256 over
 *      `id.timestamp.body`, key = the raw endpoint secret's bytes, exactly
 *      what Polar's SDK `validateEvent` does, implemented here with Web Crypto
 *      so no Node compat / SDK bloat is pulled into the edge).
 *   2. Parse the event; only `subscription.*` events change billing state.
 *   3. Resolve the Betterflag org (subscription metadata `org_id`, else the Polar
 *      customer's `external_id`, else a stored `polar_customer_id`).
 *   4. Persist status + plan + `past_due_since` (set on first past_due, cleared
 *      otherwise). Access on non-payment is DERIVED from this state by
 *      apps/dashboard/lib/billing-lifecycle.ts (flags keep serving; the
 *      dashboard goes read-only after the 14-day grace window).
 *
 * Pure functions are exported and unit-tested; the handler only wires I/O.
 */
import { createClient } from "@supabase/supabase-js";
import { attachWorkerTracing, formatRelease, readObservability, type Observability } from "@betterflag/observability";
import { VERSION } from "./version.gen";
import { z } from "zod";

/** Paid tiers whose product metadata carries `plan_key`. */
const PAID_PLANS = ["starter", "launch", "scale"] as const;
type PaidPlan = (typeof PAID_PLANS)[number];

function isPaidPlan(v: unknown): v is PaidPlan {
  return typeof v === "string" && (PAID_PLANS as readonly string[]).includes(v);
}

function errText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// ---------------------------------------------------------------------------
// Environment (structural so tests can pass plain fakes, no miniflare)
// ---------------------------------------------------------------------------

export interface WebhookEnv {
  /** Polar webhook endpoint signing secret. */
  POLAR_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  /** Secret, `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. */
  SUPABASE_SERVICE_ROLE_KEY: string;
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

// ---------------------------------------------------------------------------
// Standard Webhooks signature verification (Web Crypto)
// ---------------------------------------------------------------------------

type HeaderSource = Headers | Record<string, string | null | undefined>;

function readHeader(headers: HeaderSource, name: string): string | null {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const record = headers as Record<string, string | null | undefined>;
  const lower = name.toLowerCase();
  for (const key of Object.keys(record)) {
    if (key.toLowerCase() === lower) return record[key] ?? null;
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compute the base64 Standard Webhooks signature for `id.timestamp.body`.
 * Key = the UTF-8 bytes of the raw secret (matches Polar's `validateEvent`,
 * which base64-encodes the secret before handing it to standardwebhooks, which
 * base64-decodes it straight back).
 */
export async function computeStandardWebhookSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${timestamp}.${body}`));
  return bytesToBase64(new Uint8Array(sig));
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyPolarSignature(
  rawBody: string,
  headers: HeaderSource,
  secret: string,
  opts?: { now?: Date; toleranceSeconds?: number },
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: "missing secret" };

  const id = readHeader(headers, "webhook-id") ?? readHeader(headers, "svix-id");
  const timestamp = readHeader(headers, "webhook-timestamp") ?? readHeader(headers, "svix-timestamp");
  const signatureHeader =
    readHeader(headers, "webhook-signature") ?? readHeader(headers, "svix-signature");
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, reason: "missing signature headers" };
  }

  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return { ok: false, reason: "bad timestamp" };
  const nowSeconds = Math.floor((opts?.now?.getTime() ?? Date.now()) / 1000);
  const tolerance = opts?.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - tsSeconds) > tolerance) {
    return { ok: false, reason: "timestamp outside tolerance" };
  }

  const expected = await computeStandardWebhookSignature(secret, id, timestamp, rawBody);
  // Header is space-separated `version,signature` pairs; we accept `v1`.
  const provided = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma === -1) return null;
      return part.slice(0, comma) === "v1" ? part.slice(comma + 1) : null;
    })
    .filter((v): v is string => v !== null);

  for (const candidate of provided) {
    if (timingSafeEqual(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: "no matching signature" };
}

// ---------------------------------------------------------------------------
// Event parsing + normalization
// ---------------------------------------------------------------------------

const unknownRecord = z.record(z.string(), z.unknown());

const subscriptionDataSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    customer_id: z.string().optional(),
    modified_at: z.string().nullish(),
    metadata: unknownRecord.optional(),
    product: z.object({ metadata: unknownRecord.optional() }).partial().passthrough().optional(),
    customer: z
      .object({ id: z.string().optional(), external_id: z.string().nullish() })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export const webhookEventSchema = z.object({
  type: z.string(),
  timestamp: z.string().optional(),
  data: z.unknown(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export interface NormalizedSubscription {
  subId: string;
  status: string;
  customerId?: string;
  /** Betterflag org id from subscription metadata / customer external_id. */
  orgId?: string;
  /** Validated tier from product/subscription metadata, else undefined. */
  planKey?: PaidPlan;
  /** Event timestamp (ISO) when known. */
  occurredAt?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Normalize a `subscription.*` event into the fields we persist. Returns null
 * for any non-subscription event (they don't change billing state) or a
 * malformed subscription payload.
 */
export function normalizeSubscriptionEvent(event: WebhookEvent): NormalizedSubscription | null {
  if (!event.type.startsWith("subscription.")) return null;

  const parsed = subscriptionDataSchema.safeParse(event.data);
  if (!parsed.success) return null;
  const data = parsed.data;

  const metadata = data.metadata ?? {};
  const productMeta = data.product?.metadata ?? {};
  const planCandidate = productMeta.plan_key ?? metadata.plan_key;

  return {
    subId: data.id,
    status: data.status,
    customerId: str(data.customer_id) ?? str(data.customer?.id),
    orgId: str(metadata.org_id) ?? str(data.customer?.external_id ?? undefined),
    planKey: isPaidPlan(planCandidate) ? planCandidate : undefined,
    occurredAt: str(event.timestamp) ?? str(data.modified_at ?? undefined),
  };
}

// ---------------------------------------------------------------------------
// Billing patch (pure)
// ---------------------------------------------------------------------------

export interface OrgBillingRow {
  id: string;
  plan: string;
  polar_customer_id: string | null;
  past_due_since: string | null;
  billing_synced_at: string | null;
}

export interface OrgBillingPatch {
  subscription_status: string;
  polar_subscription_id: string;
  polar_customer_id: string | null;
  past_due_since: string | null;
  billing_synced_at: string;
  /** Only set when the event carried a valid tier. */
  plan?: PaidPlan;
}

export type PatchResult = { patch: OrgBillingPatch } | { skip: string };

/**
 * Decide the org update for a normalized subscription event.
 *
 * - `plan` is only overwritten when the event carried a valid tier, so a
 *   cancellation/revocation keeps the last subscribed tier (access is derived
 *   from `subscription_status`, not `plan`).
 * - `past_due_since` is set on the FIRST past_due (earliest wins) and cleared
 *   whenever the subscription is not past_due.
 * - Out-of-order delivery is dropped via the `billing_synced_at` guard.
 */
export function computeBillingPatch(
  norm: NormalizedSubscription,
  current: OrgBillingRow,
  nowIso: string,
): PatchResult {
  const occurredAt = norm.occurredAt ?? nowIso;

  if (current.billing_synced_at && Date.parse(occurredAt) < Date.parse(current.billing_synced_at)) {
    return { skip: "stale-event" };
  }

  const pastDueSince =
    norm.status === "past_due" ? (current.past_due_since ?? occurredAt) : null;

  const patch: OrgBillingPatch = {
    subscription_status: norm.status,
    polar_subscription_id: norm.subId,
    polar_customer_id: norm.customerId ?? current.polar_customer_id,
    past_due_since: pastDueSince,
    billing_synced_at: occurredAt,
  };
  if (norm.planKey) patch.plan = norm.planKey;
  return { patch };
}

// ---------------------------------------------------------------------------
// Store + orchestration
// ---------------------------------------------------------------------------

export interface OrgRef {
  orgId?: string;
  polarCustomerId?: string;
}

export interface BillingStore {
  findOrg(ref: OrgRef): Promise<OrgBillingRow | null>;
  updateOrg(id: string, patch: OrgBillingPatch): Promise<void>;
}

export interface WebhookResult {
  status: number;
  body: string;
}

/**
 * Full verify → parse → resolve → persist pipeline. Returns an HTTP status +
 * body. 2xx = handled (even if intentionally ignored); 4xx = rejected;
 * 5xx (thrown) = retryable. Deterministic when `now` is supplied.
 */
export async function processPolarWebhook(args: {
  rawBody: string;
  headers: HeaderSource;
  secret: string;
  store: BillingStore;
  now?: Date;
  obs?: Observability;
}): Promise<WebhookResult> {
  const now = args.now ?? new Date();
  const span = args.obs?.tracer.startSpan("webhooks.polar", { kind: "server" });

  try {
    const verifySpan = span?.startChild("verify_signature");
    const verification = await verifyPolarSignature(args.rawBody, args.headers, args.secret, { now });
    verifySpan?.setAttribute("ok", verification.ok).end();
    if (!verification.ok) {
      span?.setAttribute("event.outcome", "client_error").end();
      return { status: 401, body: `invalid signature: ${verification.reason}` };
    }

    let json: unknown;
    try {
      json = JSON.parse(args.rawBody);
    } catch {
      span?.setAttribute("event.outcome", "client_error").end();
      return { status: 400, body: "invalid json" };
    }

    const eventParse = webhookEventSchema.safeParse(json);
    if (!eventParse.success) {
      span?.setAttribute("event.outcome", "client_error").end();
      return { status: 400, body: "unrecognized event" };
    }

    const norm = normalizeSubscriptionEvent(eventParse.data);
    if (!norm) {
      span?.setAttribute("event.outcome", "ok").end();
      return { status: 200, body: "ignored (non-subscription event)" };
    }
    if (!norm.orgId && !norm.customerId) {
      span?.setAttribute("event.outcome", "ok").end();
      return { status: 202, body: "no org reference on event" };
    }

    const resolveSpan = span?.startChild("resolve_org");
    const org = await args.store.findOrg({ orgId: norm.orgId, polarCustomerId: norm.customerId });
    resolveSpan?.setAttribute("found", org !== null).end();
    if (!org) {
      span?.setAttribute("event.outcome", "ok").end();
      return { status: 202, body: "org not found" };
    }

    const result = computeBillingPatch(norm, org, now.toISOString());
    if ("skip" in result) {
      span?.setAttributes({ "event.outcome": "ok", stale: true }).end();
      return { status: 200, body: result.skip };
    }

    const updateSpan = span?.startChild("supabase.update", { kind: "client" });
    await args.store.updateOrg(org.id, result.patch);
    updateSpan?.end();
    span?.setAttributes({ "event.outcome": "ok", org_id: org.id }).end();
    return { status: 200, body: "ok" };
  } catch (error) {
    span?.recordException(error).end();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed store
// ---------------------------------------------------------------------------

const ORG_BILLING_COLUMNS = "id,plan,polar_customer_id,past_due_since,billing_synced_at";

export function createSupabaseStore(
  env: Pick<WebhookEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
): BillingStore {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, init) },
  });

  return {
    async findOrg(ref) {
      if (ref.orgId) {
        const { data, error } = await supabase
          .from("orgs")
          .select(ORG_BILLING_COLUMNS)
          .eq("id", ref.orgId)
          .maybeSingle();
        if (error) throw new Error(`orgs lookup by id failed: ${error.message}`);
        if (data) return data as OrgBillingRow;
      }
      if (ref.polarCustomerId) {
        const { data, error } = await supabase
          .from("orgs")
          .select(ORG_BILLING_COLUMNS)
          .eq("polar_customer_id", ref.polarCustomerId)
          .maybeSingle();
        if (error) throw new Error(`orgs lookup by polar_customer_id failed: ${error.message}`);
        if (data) return data as OrgBillingRow;
      }
      return null;
    },

    async updateOrg(id, patch) {
      const { error } = await supabase.from("orgs").update(patch).eq("id", id);
      if (error) throw new Error(`orgs update failed: ${error.message}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

const handler = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("ok", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    attachWorkerTracing(ctx);
    const obs = readObservability(env as unknown as Record<string, unknown>, "betterflag-webhooks", {
      environment: env.BETTERFLAG_ENV,
      release: formatRelease({ version: VERSION, gitSha: env.BETTERFLAG_GIT_SHA, override: env.BETTERFLAG_RELEASE }),
      runtime: "worker",
    });

    try {
      const rawBody = await request.text();
      const store = createSupabaseStore(env);
      const result = await processPolarWebhook({
        rawBody,
        headers: request.headers,
        secret: env.POLAR_WEBHOOK_SECRET,
        store,
        obs,
      });

      const fields = {
        status: result.status,
        detail: result.body,
        "event.name": "webhooks.polar",
        "event.outcome": result.status >= 500 ? "error" : result.status >= 400 ? "client_error" : "ok",
      };
      if (result.status >= 400) {
        obs.logger.warn("polar webhook rejected", fields);
      } else {
        obs.logger.info("polar webhook handled", fields);
      }
      return new Response(result.body, { status: result.status });
    } catch (error) {
      obs.logger.error("polar webhook failed; Polar will retry", {
        error: errText(error),
        "event.name": "webhooks.polar",
        "event.outcome": "error",
      });
      return new Response("internal error", { status: 500 });
    } finally {
      ctx.waitUntil(obs.flush());
    }
  },
} satisfies ExportedHandler<WebhookEnv>;

export default handler;
