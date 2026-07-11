/**
 * Shared pieces for the ITR-62 analytics benchmarks: seeded RNG, zipf
 * sampler, synthetic evaluation-event generator, percentile math and a
 * minimal ClickHouse HTTP client that mirrors the prod insert/query paths.
 *
 * Plain Node (>=20), zero dependencies. Everything is deterministic from
 * SEED except timestamps, which anchor to the run's start time.
 */

// ---------------------------------------------------------------------------
// RNG + distributions
// ---------------------------------------------------------------------------

/** Deterministic 32-bit RNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zipf sampler over ranks 0..n-1 (rank 0 most likely). Precomputes the CDF
 * once; sampling is a binary search.
 */
export function zipfSampler(n, s, rand) {
  const cdf = new Float64Array(n);
  let total = 0;
  for (let k = 0; k < n; k += 1) {
    total += 1 / (k + 1) ** s;
    cdf[k] = total;
  }
  for (let k = 0; k < n; k += 1) cdf[k] /= total;
  return function sample() {
    const u = rand();
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

/** Weighted pick from [[value, weight], ...]. */
export function weightedPicker(entries, rand) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  return function pick() {
    let u = rand() * total;
    for (const [value, w] of entries) {
      u -= w;
      if (u <= 0) return value;
    }
    return entries[entries.length - 1][0];
  };
}

// ---------------------------------------------------------------------------
// Synthetic evaluation events (mirrors ClickHouseEvaluationRow in apps/ingest)
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  seed: 62,
  orgs: 50,
  /** Flags per org: 3..8, average ~5. */
  minFlagsPerOrg: 3,
  maxFlagsPerOrg: 8,
  /** Zipf exponents: org traffic and per-org flag traffic. */
  orgZipfS: 1.0,
  flagZipfS: 1.1,
  /** Timestamp spread, most recent event = run start. */
  windowDays: 30,
  orgPrefix: "bench-org",
};

const COUNTRIES = [
  ["US", 30], ["DE", 10], ["GB", 8], ["FR", 8], ["IN", 7], ["BR", 5],
  ["CA", 4], ["NL", 4], ["AU", 3], ["JP", 3], ["ES", 3], ["PL", 2],
  ["SE", 2], ["SG", 2], ["MX", 2], ["unknown", 5],
];

const REASONS = [
  ["default", 55], ["rollout", 30], ["rule_match", 10],
  ["killed", 2], ["disabled", 2], ["not_found", 1],
];

const ACTOR_KINDS = [["sdk", 97], ["api", 2], ["agent", 1]];

const SDKS = [
  ["js/0.1.0", 45], ["react/0.1.0", 25], ["node/0.1.0", 20],
  ["js/0.0.9", 5], ["unknown", 5],
];

/** Deterministic 64-bit mix of (orgIdx, userIdx) as a decimal string. */
function userHash(orgIdx, userIdx) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const part of [BigInt(orgIdx), BigInt(userIdx)]) {
    h = (h ^ (part & mask)) * prime & mask;
    h = (h ^ (part >> 5n)) * prime & mask;
  }
  return h.toString(10);
}

/** ms epoch → ClickHouse DateTime64(3) string, always UTC. */
export function toClickHouseDateTime64(ms) {
  return new Date(ms).toISOString().slice(0, -1).replace("T", " ");
}

/**
 * Create the deterministic event generator. Events are yielded in
 * CHRONOLOGICAL order across the window (mirrors prod queue batches, and
 * keeps each insert inside 1-2 daily partitions instead of ~30).
 *
 * Returns { config, next(i, total) } where next() builds event #i of a run
 * of `total` events.
 */
export function makeGenerator(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const rand = mulberry32(config.seed);
  const pickOrg = zipfSampler(config.orgs, config.orgZipfS, rand);
  const pickCountry = weightedPicker(COUNTRIES, rand);
  const pickReason = weightedPicker(REASONS, rand);
  const pickActor = weightedPicker(ACTOR_KINDS, rand);
  const pickSdk = weightedPicker(SDKS, rand);

  // Per-org fixed shape: flag count, env mix, user pool size, flag sampler.
  const orgShape = [];
  for (let o = 0; o < config.orgs; o += 1) {
    const flags = config.minFlagsPerOrg +
      Math.floor(rand() * (config.maxFlagsPerOrg - config.minFlagsPerOrg + 1));
    orgShape.push({
      flags,
      pickFlag: zipfSampler(flags, config.flagZipfS, rand),
      // Bigger orgs (lower rank) have bigger user pools.
      users: Math.max(200, Math.floor(100_000 / (o + 1))),
      projects: rand() < 0.3 ? 2 : 1,
    });
  }

  const windowMs = config.windowDays * 24 * 3600 * 1000;
  const endMs = overrides.windowEndMs ?? Date.now();
  const startMs = endMs - windowMs;

  function next(i, total) {
    const orgIdx = pickOrg();
    const shape = orgShape[orgIdx];
    const org = `${config.orgPrefix}-${String(orgIdx).padStart(2, "0")}`;
    const flagIdx = shape.pickFlag();
    const projectIdx = shape.projects === 2 && rand() < 0.25 ? 1 : 0;
    const envRoll = rand();
    const env = envRoll < 0.8 ? "prod" : envRoll < 0.95 ? "staging" : "dev";
    const anonymous = rand() < 0.01;
    const userIdx = Math.floor(rand() * shape.users);
    // Boolean flags with a per-flag on/off bias; flagIdx 0 is multivariate.
    const variation = flagIdx === 0
      ? (rand() < 0.5 ? "control" : rand() < 0.6 ? "treatment-a" : "treatment-b")
      : (rand() < 0.3 + 0.5 * ((flagIdx * 7919) % 100) / 100 ? "on" : "off");
    // Chronological with ±26s jitter (half the average 100-row batch span).
    const tsMs = startMs + (windowMs * i) / total + (rand() - 0.5) * 52_000;

    return {
      ts: toClickHouseDateTime64(Math.min(Math.max(tsMs, startMs), endMs)),
      org_id: org,
      project_id: `${org}-proj-${projectIdx}`,
      env,
      flag_key: `${org}-flag-${flagIdx}`,
      variation,
      reason: pickReason(),
      actor_kind: pickActor(),
      sdk: pickSdk(),
      user_hash: anonymous ? "0" : userHash(orgIdx, userIdx),
      country: pickCountry(),
    };
  }

  return { config: { ...config, windowStartMs: startMs, windowEndMs: endMs }, next };
}

// ---------------------------------------------------------------------------
// Percentiles
// ---------------------------------------------------------------------------

/** p in [0, 100] over a non-empty array (not mutated). */
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function latencySummary(values) {
  return {
    count: values.length,
    p50Ms: round2(percentile(values, 50)),
    p95Ms: round2(percentile(values, 95)),
    p99Ms: round2(percentile(values, 99)),
    minMs: round2(values.length ? Math.min(...values) : null),
    maxMs: round2(values.length ? Math.max(...values) : null),
    meanMs: round2(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null),
  };
}

export function round2(value) {
  return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// ClickHouse HTTP client (mirrors apps/ingest insert + apps/dashboard query)
// ---------------------------------------------------------------------------

export function clickhouseEnv() {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    console.error(
      "CLICKHOUSE_URL is not set. Run with:\n" +
      "  node --env-file=../../apps/dashboard/.env.local <script>",
    );
    process.exit(1);
  }
  return {
    url,
    user: process.env.CLICKHOUSE_USER ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
  };
}

function authHeader(ch) {
  return "Basic " + Buffer.from(`${ch.user}:${ch.password}`).toString("base64");
}

/**
 * INSERT rows (JSONEachRow over HTTP), the exact prod path from
 * apps/ingest/src/index.ts. Returns elapsed ms; throws on non-2xx.
 */
export async function chInsert(ch, rows) {
  const query = encodeURIComponent("INSERT INTO evaluations FORMAT JSONEachRow");
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  const started = performance.now();
  const response = await fetch(`${ch.url}/?query=${query}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(ch),
      "Content-Type": "text/plain; charset=utf-8",
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`insert failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  await response.text();
  return performance.now() - started;
}

/**
 * SELECT with bound {name:Type} params, FORMAT JSONEachRow, the exact prod
 * path from apps/dashboard/lib/clickhouse.ts. Returns { rows, elapsedMs }.
 */
export async function chQuery(ch, sql, params = {}) {
  const url = new URL(ch.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`param_${key}`, String(value));
  }
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(ch), "Content-Type": "text/plain" },
    body: `${sql} FORMAT JSONEachRow`,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`query failed: ${response.status} ${text.slice(0, 300)}`);
  }
  const elapsedMs = performance.now() - started;
  const rows = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  return { rows, elapsedMs };
}

/** Statement without result rows (DELETE, ALTER, ...), no FORMAT appended. */
export async function chCommand(ch, sql, params = {}) {
  const url = new URL(ch.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`param_${key}`, String(value));
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(ch), "Content-Type": "text/plain" },
    body: sql,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`command failed: ${response.status} ${text.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Result partials (each bench writes one; report.mjs assembles)
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writePartial(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote ${path}`);
}

/** Tiny argv parser: --key value / --key / positional-free. */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}
