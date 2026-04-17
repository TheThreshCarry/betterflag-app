# Tinybird — shipos analytics

Tinybird is the customer-facing analytics store. Every flag evaluation and SDK event flows through Tinybird Pipes, which back the tenant founder's dashboards.

> PostHog lives in parallel for **internal** super-admin observability only. Tenant founders never see PostHog.

## Layout

```
tinybird/
  datasources/
    flag_evaluations.datasource   # one row per SDK flag evaluation
    events.datasource             # pageviews + custom events
  pipes/
    flag_evals_timeseries.pipe
    flag_evals_by_country.pipe
    flag_evals_variant_breakdown.pipe
    events_timeseries.pipe
    events_top_pages.pipe
    events_top_referrers.pipe
```

Every pipe takes `organization_id` (required) and date range params (`from`, `to`). Dashboard queries sign a per-request token scoped to the caller's org using `TINYBIRD_ADMIN_TOKEN` so cross-tenant reads are impossible.

## Deploy

```bash
bunx -y tinybird-cli push datasources/*.datasource
bunx -y tinybird-cli push pipes/*.pipe
```

Or via the dashboard: create a workspace per env (dev/staging/prod), push these files.

## Env vars (shipos-app)

```
TINYBIRD_HOST=https://api.tinybird.co
TINYBIRD_INGEST_TOKEN=...   # worker-only; write scope on events + flag_evaluations
TINYBIRD_ADMIN_TOKEN=...    # app; used to mint per-request read tokens
```

## Ingestion

Worker posts NDJSON to `POST {TINYBIRD_HOST}/v0/events?name=<datasource>` with `Authorization: Bearer TINYBIRD_INGEST_TOKEN`. Fire-and-forget via `c.executionCtx.waitUntil`.

## Reads

`lib/actions/flag-analytics.ts` (server actions) mints a scoped JWT from `TINYBIRD_ADMIN_TOKEN` via `lib/tinybird.ts` → calls Pipe endpoints with `organization_id` param.
