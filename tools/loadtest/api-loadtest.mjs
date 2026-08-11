/**
 * Edge evaluation-worker load test (ramped, open-loop).
 *
 * Drives POST /v1/evaluate at a series of target RPS stages and records the
 * exact UTC window of each stage so server-side latency can be sliced out of
 * Better Stack afterwards (source `betterflag-api`, field `duration_ms`).
 *
 * Why two latency numbers:
 * - CLIENT latency (measured here) = network RTT from this machine to the
 *   nearest Cloudflare PoP + edge work. Dominated by where you run this.
 * - SERVER latency (Better Stack `duration_ms`) = the worker's own span
 *   duration. This is the number that reflects the edge itself, and it is
 *   what the P50/P95/P99 report is built from. See analyze-loadtest.mjs.
 *
 * Open-loop on purpose: requests are scheduled on a fixed cadence and are NOT
 * gated on the previous response, so a slow edge shows up as rising latency
 * and in-flight count rather than as a silently reduced request rate (which is
 * what a closed-loop harness would do, hiding the very thing we are measuring).
 *
 * A quiet gap is inserted between stages so each stage maps to an unambiguous
 * time window in Better Stack.
 *
 * Usage (from repo root):
 *   node --env-file=apps/api/.dev.vars tools/loadtest/api-loadtest.mjs
 *   node --env-file=apps/api/.dev.vars tools/loadtest/api-loadtest.mjs \
 *     --stages 25:60,50:60,100:60,200:60 --gap 5 --out tools/loadtest/results
 *
 * Env:
 *   BETTERFLAG_BENCH_SDK_KEY (or BETTERFLAG_LOADTEST_SDK_KEY / BETTERFLAG_PROD_SDK_KEY)
 *   BETTERFLAG_PUBLIC_API_URL   default https://api.betterflag.app
 *   BETTERFLAG_LOADTEST_FLAG_KEY  optional; omit for an all-flags evaluation
 *
 * WARNING: this hits PRODUCTION. Every request is a real evaluation: it counts
 * on the billing meter (once per flag returned), emits a ClickHouse event and
 * an Analytics Engine point, and writes one Better Stack log line.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Args + config
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const SDK_KEY =
  process.env.BETTERFLAG_LOADTEST_SDK_KEY ??
  process.env.BETTERFLAG_BENCH_SDK_KEY ??
  process.env.BETTERFLAG_PROD_SDK_KEY;
const EDGE_URL = process.env.BETTERFLAG_PUBLIC_API_URL ?? "https://api.betterflag.app";
const FLAG_KEY = process.env.BETTERFLAG_LOADTEST_FLAG_KEY;
const OUT_DIR = args.out ?? "tools/loadtest/results";
const GAP_SECONDS = Number(args.gap ?? 5);
/** Per-request timeout. A hung connection must never stall the whole run. */
const REQUEST_TIMEOUT_MS = Number(args["timeout-ms"] ?? 10_000);
/**
 * Safety valve. If in-flight exceeds this, the generator is outrunning either
 * the network or the edge, so we stop scheduling and record the shortfall
 * instead of piling up sockets until everything wedges.
 */
const MAX_IN_FLIGHT = Number(args["max-in-flight"] ?? 1000);
/** Hard cap on the post-stage drain, so a straggler cannot hang the run. */
const DRAIN_TIMEOUT_MS = REQUEST_TIMEOUT_MS + 5_000;

/** "25:60,50:60" -> [{rps:25,seconds:60}, {rps:50,seconds:60}] */
function parseStages(spec) {
  return spec.split(",").map((part) => {
    const [rps, seconds] = part.split(":").map(Number);
    if (!Number.isFinite(rps) || !Number.isFinite(seconds)) {
      throw new Error(`bad stage "${part}", expected rps:seconds`);
    }
    return { rps, seconds };
  });
}

const STAGES = parseStages(args.stages ?? "25:60,50:60,100:60,200:60");

if (SDK_KEY === undefined || SDK_KEY === "") {
  console.error("missing SDK key: set BETTERFLAG_BENCH_SDK_KEY (or BETTERFLAG_LOADTEST_SDK_KEY)");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Percentiles (nearest-rank, matches apps/api/test-prod/prod-latency.test.ts)
// ---------------------------------------------------------------------------

export function percentile(sortedMs, q) {
  if (sortedMs.length === 0) return Number.NaN;
  const rank = Math.ceil(q * sortedMs.length);
  return sortedMs[Math.min(Math.max(rank, 1), sortedMs.length) - 1];
}

function summarize(samples) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const round = (n) => Math.round(n * 10) / 10;
  return {
    count: sorted.length,
    min_ms: round(sorted[0]),
    p50_ms: round(percentile(sorted, 0.5)),
    p95_ms: round(percentile(sorted, 0.95)),
    p99_ms: round(percentile(sorted, 0.99)),
    max_ms: round(sorted[sorted.length - 1]),
    avg_ms: round(sum / sorted.length),
  };
}

// ---------------------------------------------------------------------------
// One request
// ---------------------------------------------------------------------------

const BODY = JSON.stringify(
  FLAG_KEY === undefined
    ? { context: { userId: "__USER__" } }
    : { key: FLAG_KEY, context: { userId: "__USER__" } },
);

async function evaluateOnce(userId, stage, state) {
  const started = performance.now();
  try {
    const response = await fetch(`${EDGE_URL}/v1/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SDK_KEY}`,
        "X-Betterflag-SDK": "loadtest/1.0",
      },
      body: BODY.replace("__USER__", userId),
      // Without this, one connection that never settles pins in-flight above
      // zero forever and the stage drain loop hangs for good.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const ms = performance.now() - started;
    // Drain the body so the connection is released back to the pool.
    const payload = await response.json().catch(() => null);

    if (response.status === 200) {
      stage.clientLatencies.push(ms);
      stage.ok += 1;
      if (state.flagsPerRequest === null && payload?.results) {
        state.flagsPerRequest = payload.results.length;
        state.snapshotVersion = payload.version;
      }
    } else {
      stage.failed += 1;
      stage.statusCounts[response.status] = (stage.statusCounts[response.status] ?? 0) + 1;
    }
  } catch (error) {
    stage.failed += 1;
    const label = error instanceof Error ? error.name : "unknown";
    stage.errorCounts[label] = (stage.errorCounts[label] ?? 0) + 1;
  } finally {
    state.inFlight -= 1;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Ramp
// ---------------------------------------------------------------------------

async function main() {
  console.log(`edge load test -> ${EDGE_URL}`);
  console.log(`target: ${FLAG_KEY ?? "(all flags)"}`);
  console.log(
    `stages: ${STAGES.map((s) => `${s.rps} RPS x ${s.seconds}s`).join(", ")} (gap ${GAP_SECONDS}s)`,
  );

  // Smoke: fail fast on a bad key before generating load.
  const smoke = await fetch(`${EDGE_URL}/v1/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SDK_KEY}`,
      "X-Betterflag-SDK": "loadtest/1.0",
    },
    body: JSON.stringify({ context: { userId: "smoke" } }),
  });
  if (smoke.status !== 200) {
    console.error(`smoke failed: HTTP ${smoke.status} ${await smoke.text()}`);
    process.exit(1);
  }
  const smokeBody = await smoke.json();
  console.log(
    `smoke ok: ${smokeBody.results.length} flag(s), snapshot v${smokeBody.version}\n`,
  );

  const state = { inFlight: 0, flagsPerRequest: null, snapshotVersion: null };
  const results = [];
  let seq = 0;

  const runStartedAt = new Date().toISOString();

  for (const [index, config] of STAGES.entries()) {
    const stage = {
      stage: index + 1,
      target_rps: config.rps,
      seconds: config.seconds,
      startedAt: null,
      endedAt: null,
      sent: 0,
      ok: 0,
      failed: 0,
      dropped: 0,
      abandoned: 0,
      statusCounts: {},
      errorCounts: {},
      clientLatencies: [],
      maxInFlight: 0,
    };

    const intervalMs = 1000 / config.rps;
    const stageStart = performance.now();
    stage.startedAt = new Date().toISOString();

    // Open-loop: fire on a fixed cadence, never await the response.
    const planned = config.rps * config.seconds;
    let lastProgress = stageStart;

    for (let i = 0; i < planned; i += 1) {
      const due = stageStart + i * intervalMs;
      const drift = due - performance.now();
      if (drift > 1) await sleep(drift);

      // Backpressure: if we cannot keep up, record the shortfall rather than
      // opening unbounded sockets (which is what wedges a load generator).
      if (state.inFlight >= MAX_IN_FLIGHT) {
        stage.dropped += 1;
        continue;
      }

      state.inFlight += 1;
      stage.sent += 1;
      if (state.inFlight > stage.maxInFlight) stage.maxInFlight = state.inFlight;
      seq += 1;
      void evaluateOnce(`load-${seq}`, stage, state);

      if (performance.now() - lastProgress > 10_000) {
        lastProgress = performance.now();
        const elapsed = (performance.now() - stageStart) / 1000;
        console.log(
          `  [stage ${stage.stage}] ${elapsed.toFixed(0)}s: sent ${stage.sent} ` +
            `(${(stage.sent / elapsed).toFixed(1)} RPS) ok ${stage.ok} fail ${stage.failed} ` +
            `in-flight ${state.inFlight}`,
        );
      }
    }

    // Let in-flight requests land, but never wait forever on a straggler.
    const drainStart = performance.now();
    while (state.inFlight > 0 && performance.now() - drainStart < DRAIN_TIMEOUT_MS) {
      await sleep(20);
    }
    if (state.inFlight > 0) {
      console.warn(`  [stage ${stage.stage}] drain timed out, ${state.inFlight} still in flight`);
      stage.abandoned = state.inFlight;
      state.inFlight = 0;
    }
    stage.endedAt = new Date().toISOString();

    const elapsedSec = (performance.now() - stageStart) / 1000;
    stage.achieved_rps = Math.round((stage.sent / elapsedSec) * 10) / 10;
    stage.client = summarize(stage.clientLatencies);
    delete stage.clientLatencies;

    console.log(
      `stage ${stage.stage}: ${stage.target_rps} RPS target / ${stage.achieved_rps} achieved | ` +
        `ok ${stage.ok} fail ${stage.failed} | client p50 ${stage.client?.p50_ms}ms ` +
        `p95 ${stage.client?.p95_ms}ms p99 ${stage.client?.p99_ms}ms | max in-flight ${stage.maxInFlight}`,
    );

    results.push(stage);

    // Quiet gap so each stage is an unambiguous window in Better Stack.
    if (index < STAGES.length - 1) await sleep(GAP_SECONDS * 1000);
  }

  const runEndedAt = new Date().toISOString();

  const totalSent = results.reduce((a, s) => a + s.sent, 0);
  const totalOk = results.reduce((a, s) => a + s.ok, 0);
  const totalFailed = results.reduce((a, s) => a + s.failed, 0);
  const flagsPerRequest = state.flagsPerRequest ?? 0;

  const report = {
    tool: "api-loadtest",
    generatedAt: runEndedAt,
    target: {
      api_url: EDGE_URL,
      flag_key: FLAG_KEY ?? null,
      mode: FLAG_KEY === undefined ? "all-flags" : "single-flag",
      flags_per_request: flagsPerRequest,
      snapshot_version: state.snapshotVersion,
    },
    window: { startedAt: runStartedAt, endedAt: runEndedAt },
    totals: {
      requests_sent: totalSent,
      requests_ok: totalOk,
      requests_failed: totalFailed,
      error_rate: totalSent === 0 ? 0 : Math.round((totalFailed / totalSent) * 10000) / 10000,
      billable_evaluations: totalOk * flagsPerRequest,
    },
    stages: results,
    note:
      "client.* is RTT observed from the load generator and includes network " +
      "distance. Server-side p50/p95/p99 come from Better Stack duration_ms, " +
      "see analyze-loadtest.mjs.",
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = runEndedAt.replace(/[:.]/g, "-");
  const outPath = join(OUT_DIR, `loadtest-${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\ntotals: ${totalSent} sent, ${totalOk} ok, ${totalFailed} failed`);
  console.log(`billable evaluations: ${report.totals.billable_evaluations.toLocaleString()}`);
  console.log(`\nwrote ${outPath}`);
  console.log("\nstage windows (UTC), for the Better Stack slice:");
  for (const stage of results) {
    console.log(`  stage ${stage.stage} (${stage.target_rps} RPS): ${stage.startedAt} .. ${stage.endedAt}`);
  }
}

await main();
