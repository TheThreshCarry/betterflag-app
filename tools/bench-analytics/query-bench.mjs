/**
 * ITR-62 Phase 0: ClickHouse query benchmark (Q1-Q5).
 *
 * Runs the five workload queries against the bench dataset through the exact
 * prod query path (HTTP POST, bound params, FORMAT JSONEachRow, see
 * apps/dashboard/lib/clickhouse.ts). Per query: 1 cold run (first touch,
 * caches as-is) then 10 warm runs; p50/p95 are over the warm runs. Q5 fires
 * Q2 20x in parallel, 3 rounds, simulating dashboard load.
 *
 * Usage (after insert-bench populated bench-org-*):
 *   node --env-file=../../apps/dashboard/.env.local query-bench.mjs \
 *     [--org bench-org-00] [--flag bench-org-00-flag-0] [--label clickhouse]
 */

import {
  chQuery,
  clickhouseEnv,
  latencySummary,
  parseArgs,
  round2,
  writePartial,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const org = args["org"] ?? "bench-org-00";
const flag = args["flag"] ?? `${org}-flag-0`;
const label = args["label"] ?? "clickhouse";
const WARM_RUNS = 10;

const ch = clickhouseEnv();

const QUERIES = {
  q1_billing_meter: {
    description: "sum(evaluations) per org, current month (evals_per_org_day)",
    sql: `SELECT org_id, sum(evaluations) AS evaluations
          FROM evals_per_org_day
          WHERE day >= toStartOfMonth(today())
          GROUP BY org_id
          ORDER BY evaluations DESC`,
    params: {},
  },
  q2_dashboard_series: {
    description: "per-flag per-hour series, 1 org, 7 days (evals_per_flag_hour)",
    sql: `SELECT flag_key, variation, hour, sum(evaluations) AS evaluations
          FROM evals_per_flag_hour
          WHERE org_id = {orgId:String} AND hour >= now() - INTERVAL 7 DAY
          GROUP BY flag_key, variation, hour
          ORDER BY flag_key ASC, hour ASC`,
    params: { orgId: org },
  },
  q3_geo_breakdown: {
    description: "country breakdown, 1 org, 24h (evals_per_flag_country_hour)",
    sql: `SELECT country, sum(evaluations) AS evaluations
          FROM evals_per_flag_country_hour
          WHERE org_id = {orgId:String} AND hour >= now() - INTERVAL 24 HOUR
          GROUP BY country
          ORDER BY evaluations DESC
          LIMIT 50`,
    params: { orgId: org },
  },
  q4_raw_top_variations: {
    description: "top variations, 1 flag, 7 days, raw evaluations scan",
    sql: `SELECT variation, count() AS evaluations
          FROM evaluations
          WHERE org_id = {orgId:String}
            AND flag_key = {flagKey:String}
            AND ts >= now() - INTERVAL 7 DAY
          GROUP BY variation
          ORDER BY evaluations DESC`,
    params: { orgId: org, flagKey: flag },
  },
};

async function benchQuery(name, spec) {
  const cold = await chQuery(ch, spec.sql, spec.params);
  const warm = [];
  let rowCount = cold.rows.length;
  for (let i = 0; i < WARM_RUNS; i += 1) {
    const run = await chQuery(ch, spec.sql, spec.params);
    warm.push(run.elapsedMs);
    rowCount = run.rows.length;
  }
  const summary = {
    description: spec.description,
    rowsReturned: rowCount,
    coldMs: round2(cold.elapsedMs),
    warm: latencySummary(warm),
  };
  console.log(
    `${name}: cold ${summary.coldMs}ms, warm p50 ${summary.warm.p50Ms}ms ` +
    `p95 ${summary.warm.p95Ms}ms (${rowCount} rows)`,
  );
  return summary;
}

const results = {};
for (const [name, spec] of Object.entries(QUERIES)) {
  results[name] = await benchQuery(name, spec);
}

// Q5: dashboard load simulation, Q2 x 20 in parallel, 3 rounds.
const q2 = QUERIES.q2_dashboard_series;
const rounds = [];
const allParallel = [];
for (let round = 0; round < 3; round += 1) {
  const roundStart = performance.now();
  const runs = await Promise.all(
    Array.from({ length: 20 }, () => chQuery(ch, q2.sql, q2.params)),
  );
  const wallMs = performance.now() - roundStart;
  const latencies = runs.map((run) => run.elapsedMs);
  allParallel.push(...latencies);
  rounds.push({ wallMs: round2(wallMs), perQuery: latencySummary(latencies) });
  console.log(
    `q5 round ${round + 1}: wall ${Math.round(wallMs)}ms, ` +
    `per-query p95 ${rounds[round].perQuery.p95Ms}ms`,
  );
}
results.q5_concurrency = {
  description: "Q2 x 20 parallel, 3 rounds (dashboard load simulation)",
  rounds,
  perQuery: latencySummary(allParallel),
};

const output = {
  bench: "query",
  label,
  ranAt: new Date().toISOString(),
  org,
  flag,
  warmRunsPerQuery: WARM_RUNS,
  queries: results,
};
writePartial(`bench-results/partials/query-${label}.json`, output);
