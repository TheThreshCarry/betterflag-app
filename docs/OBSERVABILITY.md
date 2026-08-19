# Observability (Better Stack)

Betterflag ships **structured logs**, **error capture**, and **OTLP performance
traces** from every service to [Better Stack](https://betterstack.com). All of
it goes through one small, dependency-free package, `@betterflag/observability` -
that runs unchanged in Cloudflare Workers and in the Node (Next.js) dashboard.

Telemetry is **always best-effort**: every log is also mirrored to `console.*`
(so it still lands in Workers Logs / Vercel logs), and a telemetry failure can
never throw into, block, or change the behaviour of the calling code. On the
edge hot path, logs and spans are buffered in memory and flushed **after** the
response via `ctx.waitUntil(...)`, so instrumentation never adds latency to a
flag evaluation.

## Sources

Two Better Stack sources, both EU (`eu-central-1a`):

| Source | ID | Table | Host | Who writes |
|---|---|---|---|---|
| Betterflag OTel | 2692129 | `betterflag_otel` | `s2692129.eu-central-1a.betterstackdata.com` | Cloudflare OTel destination `betterflag-otel` (Workers logs+traces) and Node OTLP (dashboard/admin/landing) |
| Betterflag Tail | 2692127 | `betterflag_tail` | `s2692127.eu-central-1a.betterstackdata.com` | `betterflag-tail` Worker (one sanitized invocation summary per producer event) |

Workers do **not** POST logs/spans directly. Native `cloudflare:workers` traces and structured `console` logs export through the Cloudflare Observability destination named **`betterflag-otel`** at `head_sampling_rate: 1`. The Tail Worker is attached to API, ingest, MCP, webhooks, and lifecycle — never to itself.

Node apps keep direct OTLP HTTP to Betterflag OTel. Browser exceptions go to Better Stack Errors (Sentry-compatible SDK, `tracesSampleRate: 0` so traces stay on OTel).

Tokens are **not** committed. Put the OTel token in Vercel / local `.env`. Put the Tail token on `betterflag-tail` via `wrangler secret put BETTER_STACK_SOURCE_TOKEN`. Create the Cloudflare destination in the dashboard (name must match `betterflag-otel`).

> Correlation: Node logs and traces share Betterflag OTel. Worker traces land in the same OTel source via Cloudflare export. Tail summaries are a separate stream for invocation SLO charts.

## The package: `@betterflag/observability`

```ts
import { readObservability } from "@betterflag/observability";

const obs = readObservability(env, "betterflag-api"); // reads BETTER_STACK_* / OTEL_*
const log = obs.logger.child({ request_id });
const span = obs.tracer.startSpan("GET /v1/evaluate", { kind: "server" });

const child = span.startChild("load_snapshot");
// ... work ...
child.setAttribute("snapshot.hit", true).end();

log.info("request", { status: 200, duration_ms: span.durationMs() });
span.end();

obs.flushTo(ctx.waitUntil.bind(ctx)); // Workers: ship without blocking
// or:  await obs.flush();            // Node: await before returning
```

- **Logger**, leveled (`debug|info|warn|error`), `child(fields)` for context,
  serializes `Error`s, buffers records and POSTs them as JSON to the logs source.
- **Tracer**, builds OTLP/HTTP JSON spans by hand (no heavy OTel SDK), with
  parent/child linkage, attributes, events, `recordException`, and a
  `duration_ms` attribute on every span. `withSpan(name, fn)` wraps a function,
  recording exceptions and re-throwing.
- **`readObservability(env, service, opts?)`**, wires both from an env bag
  (`process.env` or a Worker `env`). Anything unset degrades gracefully.

## What's instrumented

- **API worker** (`apps/api`), root server span per request with child spans
  for `authenticate`, `load_snapshot`, `evaluate`; structured request log with
  status + `duration_ms`; warnings for unauthorized, bad body, and snapshot
  misses; errors for event-publish failures. Logs/spans flush via `waitUntil`.
  Success-log volume is controlled by `EDGE_LOG_SUCCESS_SAMPLE_RATE` in
  `src/index.ts` (currently `1` = every request; lower it to sample). Errors are
  always logged regardless.
- **Ingest worker** (`apps/ingest`), `ingest.events` span with a
  `clickhouse.insert` child (rows/dropped counts, retry on failure);
  `ingest.config_sync` span with `supabase.select_*` and `kv.put_snapshot`
  children; warnings for dropped messages/invalid rules, errors on failed
  inserts/syncs. Flushes in the queue handler `finally`.
- **MCP worker** (`apps/mcp`), auth outcomes logged at the gate (**never the
  key**, only `key_kind`); every control-plane call in `apiFetch` is a `client`
  span with timing, plus warn/error logs on API errors.
- **Dashboard** (`apps/dashboard`), `withErrors` wraps every `/api/v1` route
  with a server span + request log (status, `duration_ms`) and error capture via
  `handleError`; `reportServerError` covers deeper library failures (Cloudflare
  config-sync enqueue, KV writes, ClickHouse queries, auth code exchange).

## Configuration

Env keys (see `.env.example` and `apps/*/.dev.vars.example`):

| Key | Where | Secret |
|---|---|---|
| `BETTER_STACK_SOURCE_TOKEN` | per service, used for **logs and traces** | **yes** |
| `BETTER_STACK_LOGS_ENDPOINT` | per service (ingest host) | no (host only) |
| `BETTERFLAG_ENV` | all (`deployment.environment`) | no |
| `BETTERFLAG_RELEASE` | all, optional (`service.version`) | no |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `_HEADERS` | optional trace-routing override only |, |

Cloudflare destination `betterflag-otel` must exist (logs + traces) or Worker
deploys fail. Tail Worker needs its own source token:

```sh
# from apps/tail
echo "<betterflag-tail source token>" | wrangler secret put BETTER_STACK_SOURCE_TOKEN
# from apps/ingest, after a successful cold-storage run
echo "<heartbeat url>" | wrangler secret put BETTER_STACK_HEARTBEAT_URL
```

Dashboard/admin/landing: set `BETTER_STACK_SOURCE_TOKEN` (OTel),
`BETTER_STACK_LOGS_ENDPOINT`, `BETTER_STACK_ERRORS_DSN`, and `BETTERFLAG_ENV`
in Vercel (already in local `.env`).

Local dev reads `apps/*/.dev.vars` (workers) and `.env` (dashboard). With none
of it set, everything logs to the console only. Do **not** set `OTEL_*` unless
you deliberately want a service's traces to go somewhere other than its logs
source (which forfeits correlation).

## Querying

In Better Stack, filter a service's source and search on structured fields,
e.g. `status>=500`, `duration_ms>50`, `path:"/v1/evaluate"`, `request_id:...`.
Each service's source holds **both** its logs and its traces, so open a span in
the tracing view and jump straight to the correlated log lines (and vice-versa).
Build latency/throughput charts off span durations and the `duration_ms` field.
