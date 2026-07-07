# Observability (Better Stack)

ShipOS ships **structured logs**, **error capture**, and **OTLP performance
traces** from every service to [Better Stack](https://betterstack.com). All of
it goes through one small, dependency-free package — `@shipos/observability` —
that runs unchanged in Cloudflare Workers and in the Node (Next.js) dashboard.

Telemetry is **always best-effort**: every log is also mirrored to `console.*`
(so it still lands in Workers Logs / Vercel logs), and a telemetry failure can
never throw into, block, or change the behaviour of the calling code. On the
edge hot path, logs and spans are buffered in memory and flushed **after** the
response via `ctx.waitUntil(...)`, so instrumentation never adds latency to a
flag evaluation.

## Sources

Everything is split **one source per service**: each service sends **both** its
logs and its OTLP traces to its own source, which is exactly what Better Stack
needs for **one-click log↔trace correlation**.

| Service | Better Stack source | ID | Ingest host (logs + `/v1/traces`) |
|---|---|---|---|
| Edge worker | `shipos-edge` | 2578178 | `s2578178.eu-fsn-3.betterstackdata.com` |
| Ingest worker | `shipos-ingest` | 2578180 | `s2578180.eu-fsn-3.betterstackdata.com` |
| MCP worker | `shipos-mcp` | 2578182 | `s2578182.eu-fsn-3.betterstackdata.com` |
| Dashboard | `shipos-dashboard` | 2578184 | `s2578184.eu-fsn-3.betterstackdata.com` |

Each source has one ingest token used for **both** logs and traces. Tokens are
**not** committed — they live in each worker's `.dev.vars` (gitignored) for local
dev, in `wrangler secret put` for production, and in `.env` / Vercel env for the
dashboard.

> **One-click log ⇄ trace correlation.** Correlation works because three things
> line up: (1) logs and traces share the same source per service; (2) every log
> emitted inside a span carries a nested `span.trace_id` / `span.span_id` (via
> `span.logContext`) that maps to Better Stack's `.span.*` fields; (3) log
> timestamps fall within the span. In the Better Stack UI you can jump straight
> from a span to its logs and back.
>
> `readObservability` sends traces to the logs source by default. Set
> `OTEL_EXPORTER_OTLP_ENDPOINT` (+ `OTEL_EXPORTER_OTLP_HEADERS`) **only** if you
> want to route a service's traces to a *different* destination (e.g. a shared
> cross-service trace source) — doing so gives up correlation. Because the edge
> and ingest workers communicate asynchronously over queues, there's no
> cross-service trace context to preserve, so per-service is the right default.

## The package: `@shipos/observability`

```ts
import { readObservability } from "@shipos/observability";

const obs = readObservability(env, "shipos-edge"); // reads BETTER_STACK_* / OTEL_*
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

- **Logger** — leveled (`debug|info|warn|error`), `child(fields)` for context,
  serializes `Error`s, buffers records and POSTs them as JSON to the logs source.
- **Tracer** — builds OTLP/HTTP JSON spans by hand (no heavy OTel SDK), with
  parent/child linkage, attributes, events, `recordException`, and a
  `duration_ms` attribute on every span. `withSpan(name, fn)` wraps a function,
  recording exceptions and re-throwing.
- **`readObservability(env, service, opts?)`** — wires both from an env bag
  (`process.env` or a Worker `env`). Anything unset degrades gracefully.

## What's instrumented

- **Edge worker** (`apps/edge`) — root server span per request with child spans
  for `authenticate`, `load_snapshot`, `evaluate`; structured request log with
  status + `duration_ms`; warnings for unauthorized, bad body, and snapshot
  misses; errors for event-publish failures. Logs/spans flush via `waitUntil`.
  Success-log volume is controlled by `EDGE_LOG_SUCCESS_SAMPLE_RATE` in
  `src/index.ts` (currently `1` = every request; lower it to sample). Errors are
  always logged regardless.
- **Ingest worker** (`apps/ingest`) — `ingest.events` span with a
  `clickhouse.insert` child (rows/dropped counts, retry on failure);
  `ingest.config_sync` span with `supabase.select_*` and `kv.put_snapshot`
  children; warnings for dropped messages/invalid rules, errors on failed
  inserts/syncs. Flushes in the queue handler `finally`.
- **MCP worker** (`apps/mcp`) — auth outcomes logged at the gate (**never the
  key**, only `key_kind`); every control-plane call in `apiFetch` is a `client`
  span with timing, plus warn/error logs on API errors.
- **Dashboard** (`apps/dashboard`) — `withErrors` wraps every `/api/v1` route
  with a server span + request log (status, `duration_ms`) and error capture via
  `handleError`; `reportServerError` covers deeper library failures (Cloudflare
  config-sync enqueue, KV writes, ClickHouse queries, auth code exchange).

## Configuration

Env keys (see `.env.example` and `apps/*/.dev.vars.example`):

| Key | Where | Secret |
|---|---|---|
| `BETTER_STACK_SOURCE_TOKEN` | per service — used for **logs and traces** | **yes** |
| `BETTER_STACK_LOGS_ENDPOINT` | per service (ingest host) | no (host only) |
| `SHIPOS_ENV` | all (`deployment.environment`) | no |
| `SHIPOS_RELEASE` | all, optional (`service.version`) | no |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `_HEADERS` | optional trace-routing override only | — |

Workers: non-secret endpoints are committed in each `wrangler.jsonc` `vars`.
Set the one secret per worker in production:

```sh
# from apps/edge (repeat in apps/ingest, apps/mcp with each source's token)
echo "<shipos-edge source token>" | wrangler secret put BETTER_STACK_SOURCE_TOKEN
```

Dashboard: set `BETTER_STACK_SOURCE_TOKEN`, `BETTER_STACK_LOGS_ENDPOINT`, and
`SHIPOS_ENV` in the Vercel project (already in local `.env`).

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
