# ShipOS

Feature flags with **no seat tax and no MAU bill**, unlimited flags, seats
and environments, one meter (flag evaluations), served from Cloudflare's edge
in <50ms. Agentic-first: the MCP server and REST API are the primary
interface; the dashboard is the observation layer.

> **Agents don't buy seats.**

## Monorepo

| Workspace | What it is |
|---|---|
| [apps/dashboard](apps/dashboard) | Next.js control plane, auth, dashboard UI, and the `/api/v1` REST API every surface (UI, MCP, agents) goes through |
| [apps/edge](apps/edge) | Cloudflare Worker at `edge.shipos.app`, flag evaluation from KV snapshots, no DB on the hot path |
| [apps/ingest](apps/ingest) | Cloudflare Worker, Queues consumers: evaluation events → ClickHouse, config-sync → KV snapshots |
| [apps/mcp](apps/mcp) | Cloudflare Worker at `mcp.shipos.app`, MCP server wrapping the REST API with agent-scoped keys |
| [packages/core](packages/core) | Pure evaluation engine (murmur3 bucketing, targeting rules) shared by edge + SDKs, never forked |
| [packages/db](packages/db) | Supabase migrations, RLS, audit function, atomic RPCs, row types |
| [packages/sdk-js](packages/sdk-js) | `@shiposapp/sdk`, Node + browser SDK (MIT) |
| [packages/sdk-react](packages/sdk-react) | `@shiposapp/react`, provider + `useFlag` (MIT) |

## Architecture

Two planes, strictly separated:

- **Control plane** (Supabase Postgres): orgs, projects, environments, flags,
  targeting rules, keys, audit log. Every mutation goes
  through `/api/v1` → an atomic Postgres RPC (mutation + audit in one
  transaction) → a config-sync enqueue. Nothing bypasses audit.
- **Data plane** (Cloudflare): the edge worker evaluates flags from a
  denormalized KV snapshot (`cfg:{projectId}:{env}`) and emits events to
  Queues; the ingest worker lands them in ClickHouse. The hot path never
  touches Postgres. Kill-switches write KV directly from the request path,
  then reconcile through the queue.

Cross-service interfaces (KV keys, queue messages, key format, REST surface)
are pinned in [docs/CONTRACTS.md](docs/CONTRACTS.md). The REST API is specced
in [docs/openapi.yaml](docs/openapi.yaml).

## Development

```bash
pnpm install
pnpm test          # engine + worker + SDK tests
pnpm typecheck     # all workspaces
pnpm --filter @shipos/dashboard dev
```

Copy `.env.example` → `apps/dashboard/.env.local` and fill in Supabase +
Cloudflare credentials. Apply the schema with the Supabase CLI:

```bash
cd packages/db
supabase link --project-ref <ref>
supabase db push
```

Workers deploy per app with `wrangler deploy` after creating the KV namespace
(`shipos-config`) and queues (`shipos-events`, `shipos-events-dlq`,
`shipos-config-sync`); ClickHouse DDL lives in
[apps/ingest/clickhouse/schema.sql](apps/ingest/clickhouse/schema.sql).

## Invariants (do not break)

- The evaluation engine lives in `@shipos/core` only. Edge and SDKs import
  it; nobody reimplements bucketing. Frozen vectors in
  `packages/core/test/` guard cross-surface parity.
- Every mutation, dashboard, REST, MCP, lands an `audit_log` row with
  `actor_type` distinguishing humans from agents. This is a product feature.
- No PII in KV or ClickHouse: user IDs are FNV-1a-64 hashed at the edge.
- Supabase service-role key exists only in the dashboard server env;
  ClickHouse credentials only in the ingest worker (+ dashboard reads).
