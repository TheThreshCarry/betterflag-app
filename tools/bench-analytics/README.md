# bench-analytics (ITR-62)

Benchmarks for the analytics backend migration (ClickHouse Cloud to Workers
Analytics Engine + R2). Phase 0 records the ClickHouse baseline; Phase 2
reruns the equivalent queries against the AE SQL API for the comparison.

Plain Node scripts (>= 20), zero dependencies. Credentials come from env
vars; the dashboard's `.env.local` already has them:

```sh
cd tools/bench-analytics
node --env-file=../../apps/dashboard/.env.local <script>
```

## Scripts

| Script | What it does |
|---|---|
| `insert-bench.mjs` | Generates synthetic evaluation events (50 orgs, 3-8 flags each, zipf traffic, 30-day chronological spread) and inserts them through the exact prod path (`INSERT INTO evaluations FORMAT JSONEachRow` over HTTP). Records rows/s, per-batch p50/p95/p99, retries. |
| `query-bench.mjs` | Q1 billing meter, Q2 per-flag hourly series, Q3 geo breakdown, Q4 raw scan, Q5 = Q2 x 20 parallel. 1 cold + 10 warm runs each, prod query path. |
| `report.mjs` | Assembles `bench-results/partials/*` into `bench-results/clickhouse-baseline.{json,md}`. |
| `cleanup.mjs` | Deletes `org_id LIKE 'bench%'` rows from `evaluations` and the three MV inner tables. `--dry-run` prints counts. |

## The ITR-62 baseline run

```sh
# 1. Prod-shaped insert: 5M events, 100-row batches (mirrors the ingest consumer)
node --env-file=../../apps/dashboard/.env.local insert-bench.mjs \
  --events 5000000 --batch-size 100 --concurrency 8 \
  --org-prefix bench-org --label small-batch

# 2. Large-batch variant: same 5M events, 10k-row batches, separate org
#    namespace so the query dataset is not double-counted
node --env-file=../../apps/dashboard/.env.local insert-bench.mjs \
  --events 5000000 --batch-size 10000 --concurrency 4 \
  --org-prefix benchbig-org --label large-batch

# 3. Queries against the prod-shaped dataset
node --env-file=../../apps/dashboard/.env.local query-bench.mjs

# 4. Assemble the committed baseline
node report.mjs

# 5. Drop the synthetic rows (raw table would TTL out in 7 days anyway;
#    the MV inner tables would keep bench rows for 13 months without this)
node --env-file=../../apps/dashboard/.env.local cleanup.mjs
```

## Safety

- All synthetic org ids start with `bench`; real org ids are UUIDs, so bench
  data can never collide with customer data and cleanup can never touch it.
- Dashboards and the billing meter query per-org, so bench orgs never appear
  in any customer-facing number.
- Commit `bench-results/*.json` and `.md`; `bench-results/partials/` is
  scratch and gitignored.

## Cloud cost

Compute active-hours and cost cannot be read over SQL. After the run, read
them from the ClickHouse Cloud console (Usage page, scoped to the insert
window recorded in the baseline JSON) and fill `cloudCost` in
`bench-results/clickhouse-baseline.json` by hand.
