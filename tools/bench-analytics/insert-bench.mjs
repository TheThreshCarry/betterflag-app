/**
 * ITR-62 Phase 0: ClickHouse insert benchmark.
 *
 * Generates synthetic evaluation events (deterministic, chronological) and
 * inserts them through the exact prod path (HTTP `INSERT INTO evaluations
 * FORMAT JSONEachRow`, see apps/ingest/src/index.ts). Records rows/s and
 * per-batch latency percentiles.
 *
 * Usage (from tools/bench-analytics):
 *   node --env-file=../../apps/dashboard/.env.local insert-bench.mjs \
 *     --events 5000000 --batch-size 100 --concurrency 8 \
 *     --org-prefix bench-org --label small-batch
 *
 * The two ITR-62 modes:
 *   --batch-size 100   --org-prefix bench-org    --label small-batch  (mirrors prod)
 *   --batch-size 10000 --org-prefix benchbig-org --label large-batch
 * Distinct org prefixes keep the two datasets from double-counting in the
 * query bench (which reads bench-org-*) and both match cleanup's `bench%`.
 */

import {
  chInsert,
  clickhouseEnv,
  latencySummary,
  makeGenerator,
  parseArgs,
  round2,
  writePartial,
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const totalEvents = Number(args["events"] ?? 5_000_000);
const batchSize = Number(args["batch-size"] ?? 100);
const concurrency = Number(args["concurrency"] ?? 8);
const orgPrefix = args["org-prefix"] ?? "bench-org";
const label = args["label"] ?? `batch-${batchSize}`;
const maxRetries = 5;

const ch = clickhouseEnv();
const { config, next } = makeGenerator({ orgPrefix });

const totalBatches = Math.ceil(totalEvents / batchSize);
console.log(
  `inserting ${totalEvents.toLocaleString()} events in ${totalBatches.toLocaleString()} ` +
  `batches of ${batchSize} (concurrency ${concurrency}, orgs ${orgPrefix}-*)`,
);

const latencies = [];
let retries = 0;
let failedBatches = 0;
let insertedRows = 0;
let nextBatch = 0;
const startedAt = new Date();
const wallStart = performance.now();

async function insertWithRetry(rows) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await chInsert(ch, rows);
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      retries += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
}

async function worker() {
  for (;;) {
    const batchIdx = nextBatch;
    nextBatch += 1;
    if (batchIdx >= totalBatches) return;

    const from = batchIdx * batchSize;
    const to = Math.min(from + batchSize, totalEvents);
    const rows = [];
    for (let i = from; i < to; i += 1) rows.push(next(i, totalEvents));

    try {
      latencies.push(await insertWithRetry(rows));
      insertedRows += rows.length;
    } catch (error) {
      failedBatches += 1;
      console.error(`batch ${batchIdx} failed permanently: ${error.message}`);
    }

    if (batchIdx > 0 && batchIdx % Math.max(1, Math.floor(totalBatches / 20)) === 0) {
      const pct = Math.round((batchIdx / totalBatches) * 100);
      const elapsed = (performance.now() - wallStart) / 1000;
      console.log(
        `  ${pct}% (${insertedRows.toLocaleString()} rows, ` +
        `${Math.round(insertedRows / elapsed).toLocaleString()} rows/s)`,
      );
    }
  }
}

// NOTE: generation happens inside workers via the shared `next(i, total)`;
// event #i is identical regardless of concurrency, only batch completion
// order varies. The shared RNG makes per-event fields depend on call order,
// which is fine: distributions are what matter here, not per-index replay.
await Promise.all(Array.from({ length: concurrency }, () => worker()));

const wallSeconds = (performance.now() - wallStart) / 1000;
const result = {
  bench: "insert",
  label,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  wallSeconds: round2(wallSeconds),
  events: totalEvents,
  batchSize,
  concurrency,
  insertedRows,
  failedBatches,
  retries,
  rowsPerSecond: Math.round(insertedRows / wallSeconds),
  batchLatency: latencySummary(latencies),
  generator: {
    seed: config.seed,
    orgs: config.orgs,
    orgPrefix: config.orgPrefix,
    windowDays: config.windowDays,
    windowStart: new Date(config.windowStartMs).toISOString(),
    windowEnd: new Date(config.windowEndMs).toISOString(),
  },
};

console.log(JSON.stringify(result, null, 2));
writePartial(`bench-results/partials/insert-${label}.json`, result);
if (failedBatches > 0) process.exitCode = 1;
