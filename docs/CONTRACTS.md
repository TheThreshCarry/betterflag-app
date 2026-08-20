# Cross-service contracts

Single source of truth for interfaces between the control plane
(apps/dashboard), the data plane (apps/api, apps/ingest), the MCP server
(apps/mcp) and the SDKs. If you change anything here, change every consumer
in the same PR.

## API keys

- Full key: `bf_<tag>_<40 lowercase hex>` where tag ∈ `sdk|agt|adm` (48 chars).
- `prefix` = first 16 chars (`keyPrefixOf` in `@betterflag/core`); displayed in UI
  and stamped on audit rows (`actor_key_prefix`).
- Postgres stores SHA-256 hex of the full key (`api_keys.hash`); plaintext is
  returned exactly once, at creation.
- SDK keys additionally get a KV entry so the edge never touches Postgres:
  - KV key: `key:{prefix}`  → `SdkKeyKvEntry` (see `@betterflag/core`):
    `{ orgId, projectId, envSlug, hash, revoked, plan?, quota?, used? }`
  - Written on creation, updated on revoke (set `revoked: true`), refreshed
    hourly by ingest (`plan`/`quota`/`used`).
  - `quota` is null/omitted for Launch, Scale, and trial (never throttled).
    Starter `quota` is 3× included (3M). Missing fields on old entries =
    not throttled. Edge `POST /v1/evaluate` returns 429 `quota_exceeded`
    with `Retry-After: 3600` when `used >= quota`; it does not emit events.

## KV snapshots

- KV key: `cfg:{projectId}:{envSlug}` → `ProjectSnapshot` (see `@betterflag/core`).
- `version` is epoch-ms at build time; writers must read-then-skip if the
  existing entry has a NEWER version (queue redelivery protection).
- Built ONLY via `buildSnapshot()` from `@betterflag/core`, never hand-rolled.

## Queues

- `betterflag-config-sync`, producer: control plane (HTTP API). Consumer: ingest.
  Message: `{ "type": "sync", "projectId": uuid, "environmentId": uuid, "envSlug": string, "orgId": uuid }`
- `betterflag-events`, producer: edge (binding `EVENTS`). Consumer: ingest.
  Message: one `EvaluationEvent` (see `@betterflag/core`), `user_hash` as decimal string.
- `betterflag-events-dlq`, dead letter queue for `betterflag-events`.
- Kill-switch fast path: the control plane writes the rebuilt snapshot
  straight to KV via the Cloudflare REST API, then enqueues a sync message
  for reconciliation.

## Control plane REST API (`/api/v1` on dashboard.betterflag.app)

Auth: Supabase session cookie (dashboard) OR `Authorization: Bearer bf_adm_*|bf_agt_*`.
A valid key executes mutations directly.
Errors: `{ "error": { "code": string, "message": string } }` with 400/401/403/404/409/422.

| Method | Path | Notes |
|---|---|---|
| GET | /api/v1/projects | list caller's org projects (with environments) |
| POST | /api/v1/projects | `{name, slug}`; creates dev/staging/prod via `create_project_with_envs` RPC; enforces `PLAN_LIMITS.projects` |
| GET | /api/v1/projects/:id/flags | flags + per-env configs; `?key=` filters |
| POST | /api/v1/projects/:id/flags | `{key, name, description?, kind, defaultValue?}` via `create_flag_with_configs` RPC |
| GET | /api/v1/flags/lookup?projectSlug=&key= | flag + configs by business key (MCP uses this) |
| GET | /api/v1/flags/:id | flag + configs |
| PATCH | /api/v1/flags/:id | `{name?, description?}` |
| DELETE | /api/v1/flags/:id | soft archive (`archived_at`) |
| PUT | /api/v1/flags/:id/environments/:env/config | `{enabled?, rolloutPct?, rules?, valueOn?, valueOff?, clearKill?, expectedVersion?}` via `update_flag_config` RPC; 409 on version conflict |
| POST | /api/v1/flags/:id/environments/:env/kill | `kill_flag` RPC + KV fast path |
| POST | /api/v1/flags/:id/environments/:env/promote | `{fromEnv}` copies config between envs |
| GET | /api/v1/flags/:id/environments/:env/stats?period=24h\|7d\|30d\|90d | ClickHouse `evals_per_flag_hour` + country breakdown; 422 `retention_exceeded` beyond plan retention |
| GET | /api/v1/analytics?period=&projectId=&env= | org-wide analytics from `evals_per_flag_country_hour`: total, series, countries, flags, environments; 422 beyond plan retention |
| POST | /api/v1/keys | dashboard session only, create key; returns plaintext once; not listable |
| DELETE | /api/v1/keys/:id | dashboard session only, revoke + KV update for sdk keys |
| GET | /api/v1/audit?actorType=&projectId=&limit=&before= | audit entries, newest first |
| GET | /api/v1/usage?days=30 | ClickHouse `evals_per_org_day` + plan + billing state |
| PATCH | /api/v1/orgs/:id | session-only, owner/admin; `{plan}` picks the tier pre-subscription (onboarding); 409 once a Polar subscription exists |

Response envelopes (pinned, MCP normalizers and future SDKs rely on these):
wire format is camelCase; list endpoints wrap in a named key -
`{projects}`, `{flags}`, `{flag, configs}`, `{project}`, `{config}`,
`{apiKey, plaintext}` (create only), `{entries}` (audit),
`{period, retentionDays, availablePeriods, series, countries}` (stats),
`{period, retentionDays, availablePeriods, total, series, countries, flags, environments}`
(analytics), `{usage…}`. API key hashes are never serialized.
Full schemas: docs/openapi.yaml.

Every mutation: RPC (mutation+audit atomically) → enqueue
config-sync for the affected (project, env).

## Edge evaluation API (api.betterflag.app)

- `POST /v1/evaluate`, `Authorization: Bearer bf_sdk_*`;
  body `{ key?: string, keys?: string[], context?: { userId?, attributes? } }`.
  One of key/keys, or neither = all flags.
  Response: `{ version, results: EvaluationResult[] }` (single key still returns array).
  Headers in: `X-Betterflag-SDK` (e.g. `js/0.1.0`) → event `sdk` field.
  Country fallback: when `context.attributes.country` is absent, the edge
  injects Cloudflare's `request.cf.country` (uppercased; never when
  "unknown") before rule matching, so `country` targeting works without the
  SDK sending it. Explicit context always wins. Note that the caller's
  location is the *caller's*, so server-side SDKs targeting the end user's country
  should keep passing it. `/v1/snapshot` (local evaluation) has no fallback:
  SDKs evaluating from a snapshot must supply `country` themselves.
- `GET /v1/snapshot`, same auth; `ETag: "v{version}"`, honors `If-None-Match` → 304.
- CORS: `*` (keys are publishable for sdk kind).
- Starter throttle: after auth, if the KV entry `used >= quota`, evaluate
  returns 429 `{ error: { code: "quota_exceeded" } }` with `Retry-After: 3600`
  and emits no events. Snapshot is not throttled. Missing `quota`/`used` =
  not throttled (old KV entries, Launch/Scale/trial).
- Every evaluated flag emits one `EvaluationEvent` to `EVENTS` via
  `ctx.waitUntil(sendBatch(…))`, chunked ≤100. `user_hash` = `hashUserId()`
  from core ("0" when anonymous). `country` = uppercased ISO 3166-1 alpha-2
  from Cloudflare's `request.cf.country` ("unknown" when absent); country
  only, never finer. No Postgres, no ClickHouse on this path.
- While `ANALYTICS_AE_ENABLED` is "true"/"1", the same events are also
  written to the Analytics Engine dataset (next section). Dual-write is
  shadow mode: ClickHouse stays the source of truth until the ITR-62
  Phase 2 parity gate passes.

## Analytics Engine dataset (ITR-62 dual-write)

Dataset `betterflag_evaluations`, binding `EVALS` on the API worker
(analytics_engine_datasets in apps/api/wrangler.jsonc). One data point per
evaluation, written inline (writeDataPoint is fire-and-forget, adds no edge
latency):

- `index1`: `org_id` (AE samples per index, so sampling fairness is
  per customer)
- `blob1..blob8`: `project_id`, `env`, `flag_key`, `variation`, `reason`,
  `actor_kind`, `sdk`, `country`
- `double1`: `user_hash` as f64 (lossy above 2^53; only for approximate
  distinct-user counts, exact identity stays in ClickHouse/R2)
- `double2`: `count` (1 for detail points)

Counts MUST be queried as `sum(_sample_interval * double2)`, never
`count()`: AE samples at high per-index volume, and rollup points carry
`count > 1`.

25-point budget: Workers allow 25 `writeDataPoint` calls per invocation.
When one request evaluates more than 25 flags, the edge writes 24 detail
points plus one rollup point with `flag_key = "__rollup"`,
`reason = "rollup"`, empty `variation`, and `count` = remaining
evaluations. Totals (billing) stay exact; per-flag series lose detail for
flags folded into the rollup. Consumers must exclude `flag_key = '__rollup'`
from per-flag charts.

## Analytics retention (hot → cold → deleted)

- **Hot**: raw `evaluations` rows live in ClickHouse for 7 days
  (`ANALYTICS_HOT_DAYS` in `@betterflag/db`; table TTL in
  apps/ingest/clickhouse/schema.sql). Aggregate MVs (`evals_per_org_day`
  billing meter, `evals_per_flag_hour`, `evals_per_flag_country_hour`) keep
  13 months regardless; retention governs raw event data only.
- **Cold**: a daily cron in the ingest worker (03:10 UTC) exports the day
  aging out of the hot window to R2 (binding `ANALYTICS_R2`, bucket
  `betterflag-analytics-cold`) as `analytics/{org_id}/{yyyy-mm-dd}.ndjson.gz`,
  one object per org per day, ClickHouse JSONEachRow gzipped (re-importable
  with `INSERT ... FORMAT JSONEachRow`). Idempotent: existing objects are
  skipped.
- **Deleted**: the same cron removes R2 objects older than the org's plan
  retention (`ANALYTICS_RETENTION_DAYS` in `@betterflag/db`: starter 30d,
  launch/trial 90d, scale 365d). Retention is a plan feature, not a per-org
  setting; the API rejects periods beyond it with 422 `retention_exceeded`.

## Polar metering (ITR-187)

Hourly ingest cron (`0 * * * *`, `src/meter.ts`):

1. Month-to-date evaluations per org from ClickHouse `evals_per_org_day`.
2. Emit the delta to Polar `POST /v1/events/ingest` as event name
   `evaluation`, metadata `{ evaluations: <delta> }`, `customer_id` =
   `orgs.polar_customer_id`, `external_id` = `eval:{orgId}:{yyyy-mm-ddTHH}`
   (idempotent retries). Skip Polar when the org has no customer or
   `POLAR_ACCESS_TOKEN` is unset; still stamp KV.
3. Stamp every SDK key KV entry with `plan`, `quota` (`edgeQuotaForPlan`),
   `used`. Watermark in KV at `meter:polar:{orgId}`. Pending-hour state
   covers Polar success + KV commit failure.

The Polar meter **must** aggregate `sum(evaluations)`. A count meter bills
1 per hourly event.

## Plan limits

From `PLAN_LIMITS` in `@betterflag/db`, projects and agent keys enforced at
creation time in the control plane. Evaluations are metered via Polar
(`evaluation` events, sum of metadata `evaluations`). Launch, Scale, and
trial are never blocked mid-cycle. Starter is soft-throttled at the edge at
3× included volume (3M); Polar still bills overage between included and the
throttle.

## Billing access policy (trial + subscription)

Decided by `billingDecisionForOrg` (apps/dashboard/lib/billing-status.ts):

- Org WITHOUT a synced Polar subscription: full access while
  `trial_ends_at` is in the future (`trialing`), then **`expired`**: the
  dashboard shell hard-redirects to `/billing` (plan cards → Polar checkout)
  and write APIs return 402; **flags keep serving from the edge**.
- Org WITH a synced status: the July-2026 lifecycle policy (active,
  14-day past_due grace, then read-only `restricted`).
- Super-admin freeze (`orgs.frozen_at`, set from the betterflag-admin app):
  every control-plane write (dashboard, REST, MCP) returns 403 with code
  `org_frozen` until unfrozen; reads and edge serving are unaffected.
- Onboarding is org → **pick plan** (PATCH /api/v1/orgs/:id, no card) →
  project → first flag. `orgs.plan === 'trial'` means the plan step was
  never completed.

## Lifecycle worker (welcome email sequence)

`apps/lifecycle`, Cloudflare Workflows + Email Service (`send_email` binding,
sender `hi@betterflag.app`; the betterflag.app domain must be onboarded in
dash → Email Sending).

- Trigger: `POST {LIFECYCLE_URL}/trigger` with
  `Authorization: Bearer LIFECYCLE_SECRET`, body
  `{ "orgId": uuid, "email": string, "orgName": string }`.
  Producer: control plane, after org creation (best-effort, never fails the
  request). 201 = started, 200 = instance already exists.
- One workflow instance per org, id `welcome-{orgId}` (idempotent).
- Schedule: day 0 welcome → day 3 agentic/MCP setup → day 10 trial-ending.
  Before each post-day-0 email the workflow re-reads the org from Supabase:
  deleted org stops the sequence, an active/trialing Polar subscription
  skips the day-10 upsell.
