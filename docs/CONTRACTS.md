# Cross-service contracts

Single source of truth for interfaces between the control plane
(apps/dashboard), the data plane (apps/edge, apps/ingest), the MCP server
(apps/mcp) and the SDKs. If you change anything here, change every consumer
in the same PR.

## API keys

- Full key: `sos_<tag>_<40 lowercase hex>` where tag ∈ `sdk|agt|adm` (48 chars).
- `prefix` = first 16 chars (`keyPrefixOf` in `@shipos/core`); displayed in UI
  and stamped on audit rows (`actor_key_prefix`).
- Postgres stores SHA-256 hex of the full key (`api_keys.hash`); plaintext is
  returned exactly once, at creation.
- SDK keys additionally get a KV entry so the edge never touches Postgres:
  - KV key: `key:{prefix}`  → `SdkKeyKvEntry` (see `@shipos/core`):
    `{ orgId, projectId, envSlug, hash, revoked }`
  - Written on creation, updated on revoke (set `revoked: true`).

## KV snapshots

- KV key: `cfg:{projectId}:{envSlug}` → `ProjectSnapshot` (see `@shipos/core`).
- `version` is epoch-ms at build time; writers must read-then-skip if the
  existing entry has a NEWER version (queue redelivery protection).
- Built ONLY via `buildSnapshot()` from `@shipos/core` — never hand-rolled.

## Queues

- `shipos-config-sync` — producer: control plane (HTTP API). Consumer: ingest.
  Message: `{ "type": "sync", "projectId": uuid, "environmentId": uuid, "envSlug": string, "orgId": uuid }`
- `shipos-events` — producer: edge (binding `EVENTS`). Consumer: ingest.
  Message: one `EvaluationEvent` (see `@shipos/core`), `user_hash` as decimal string.
- `shipos-events-dlq` — dead letter queue for `shipos-events`.
- Kill-switch fast path: the control plane writes the rebuilt snapshot
  straight to KV via the Cloudflare REST API, then enqueues a sync message
  for reconciliation.

## Control plane REST API (`/api/v1` on app.shipos.app)

Auth: Supabase session cookie (dashboard) OR `Authorization: Bearer sos_adm_*|sos_agt_*`.
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
| GET | /api/v1/flags/:id/environments/:env/stats?period=24h\|7d\|30d | ClickHouse `evals_per_flag_hour` |
| POST | /api/v1/keys | dashboard session only — create key; returns plaintext once; not listable |
| DELETE | /api/v1/keys/:id | dashboard session only — revoke + KV update for sdk keys |
| GET | /api/v1/audit?actorType=&projectId=&limit=&before= | audit entries, newest first |
| GET | /api/v1/usage?days=30 | ClickHouse `evals_per_org_day` + plan + trial state |

Response envelopes (pinned — MCP normalizers and future SDKs rely on these):
wire format is camelCase; list endpoints wrap in a named key —
`{projects}`, `{flags}`, `{flag, configs}`, `{project}`, `{config}`,
`{apiKey, plaintext}` (create only), `{entries}` (audit),
`{period, series}` (stats), `{usage…}`. API key hashes are never serialized.
Full schemas: docs/openapi.yaml.

Every mutation: RPC (mutation+audit atomically) → enqueue
config-sync for the affected (project, env).

## Edge evaluation API (edge.shipos.app)

- `POST /v1/evaluate` — `Authorization: Bearer sos_sdk_*`;
  body `{ key?: string, keys?: string[], context?: { userId?, attributes? } }`.
  One of key/keys, or neither = all flags.
  Response: `{ version, results: EvaluationResult[] }` (single key still returns array).
  Headers in: `X-ShipOS-SDK` (e.g. `js/0.1.0`) → event `sdk` field.
- `GET /v1/snapshot` — same auth; `ETag: "v{version}"`, honors `If-None-Match` → 304.
- CORS: `*` (keys are publishable for sdk kind).
- Every evaluated flag emits one `EvaluationEvent` to `EVENTS` via
  `ctx.waitUntil(sendBatch(…))`, chunked ≤100. `user_hash` = `hashUserId()`
  from core ("0" when anonymous). No Postgres, no ClickHouse on this path.

## Plan limits

From `PLAN_LIMITS` in `@shipos/db` — projects and agent keys enforced at
creation time in the control plane; evaluations are metered, never blocked
mid-cycle (except Starter throttle at 3× included volume, Phase 5).
