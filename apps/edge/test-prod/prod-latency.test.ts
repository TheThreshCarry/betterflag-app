/**
 * Production smoke + latency test for the edge evaluation API.
 *
 * Hits the REAL production edge (or SHIPOS_EDGE_URL) with a REAL SDK key,
 * verifies the response contract, and reports latency percentiles (P50
 * highlighted) for POST /v1/evaluate as observed from this machine.
 *
 *   SHIPOS_PROD_SDK_KEY=sos_sdk_... bun run test:prod
 *
 * Environment:
 * - SHIPOS_PROD_SDK_KEY   required, suite is skipped without it (so this
 *                         never runs accidentally in CI or `vitest run`)
 * - SHIPOS_EDGE_URL       default https://edge.shipos.app
 * - SHIPOS_BENCH_FLAG_KEY optional; a single flag key to evaluate.
 *                         Omitted = all-flags evaluation.
 * - SHIPOS_BENCH_SAMPLES  default 100 measured requests (after 5 warmups)
 * - SHIPOS_P50_BUDGET_MS  optional; when set, the test FAILS if P50 exceeds
 *                         it. Unset = report-only (network distance from the
 *                         machine running this dominates, so a hard default
 *                         would be flaky across locations).
 *
 * Notes on methodology:
 * - Requests are sequential (no self-contention) over a warmed connection,
 *   so numbers reflect steady-state RTT + edge work, not TLS setup.
 * - Client-observed latency includes the network path to the nearest
 *   Cloudflare PoP. The "<50ms" product claim is about edge evaluation;
 *   run this from a few regions before quoting numbers publicly.
 * - Each request emits real evaluation events and counts on the meter:
 *   ~105 evaluations per run, negligible but nonzero.
 */

import { describe, expect, it } from "vitest";
import dotenv from "dotenv";
// Local .env (apps/edge/.env) first, monorepo root .env as fallback.
// dotenv never overrides variables that are already set, so an inline
// SHIPOS_PROD_SDK_KEY=... on the command line always wins.

dotenv.config({ path: new URL("../.dev.vars", import.meta.url).pathname });

const SDK_KEY = process.env.SHIPOS_PROD_SDK_KEY;
const EDGE_URL = process.env.SHIPOS_EDGE_URL ?? "https://edge.shipos.app";
const FLAG_KEY = process.env.SHIPOS_BENCH_FLAG_KEY;
const SAMPLES = Number(process.env.SHIPOS_BENCH_SAMPLES ?? 100);
const WARMUPS = 5;
const P50_BUDGET_MS =
  process.env.SHIPOS_P50_BUDGET_MS !== undefined
    ? Number(process.env.SHIPOS_P50_BUDGET_MS)
    : undefined;

interface EvaluationResultShape {
  key: string;
  value: unknown;
  variation: string;
  reason: string;
}

interface EvaluateResponseShape {
  version: number;
  results: EvaluationResultShape[];
}

/** Nearest-rank percentile on a pre-sorted ascending array. */
export function percentile(sortedMs: readonly number[], q: number): number {
  if (sortedMs.length === 0) return Number.NaN;
  const rank = Math.ceil(q * sortedMs.length);
  return sortedMs[Math.min(Math.max(rank, 1), sortedMs.length) - 1];
}

async function evaluateOnce(userId: string): Promise<{
  ms: number;
  status: number;
  body: EvaluateResponseShape;
}> {
  const payload: Record<string, unknown> = {
    context: { userId },
  };
  if (FLAG_KEY !== undefined) payload.key = FLAG_KEY;

  const started = performance.now();
  const response = await fetch(`${EDGE_URL}/v1/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SDK_KEY}`,
      "X-ShipOS-SDK": "bench/1.0",
    },
    body: JSON.stringify(payload),
  });
  const ms = performance.now() - started;
  const body = (await response.json()) as EvaluateResponseShape;
  return { ms, status: response.status, body };
}

describe.skipIf(SDK_KEY === undefined)(
  `production edge latency (${EDGE_URL})`,
  () => {
    it("evaluates flags against production and reports latency percentiles", async () => {
      // -- Smoke: one request, checked strictly, before spending 100 more.
      const smoke = await evaluateOnce("bench-smoke");
      expect(
        smoke.status,
        `edge returned ${smoke.status}: ${JSON.stringify(smoke.body)}. A 401 ` +
          `usually means the key's KV entry was never provisioned (the ` +
          `dashboard only writes to Cloudflare KV when CF_ACCOUNT_ID / ` +
          `CF_API_TOKEN / CF_KV_NAMESPACE_ID are set in its environment).`,
      ).toBe(200);
      expect(smoke.body).toHaveProperty("version");
      expect(Array.isArray(smoke.body.results)).toBe(true);
      if (FLAG_KEY !== undefined) {
        expect(smoke.body.results[0]?.key).toBe(FLAG_KEY);
        // A misspelled flag key measures the not_found path, not real work.
        expect(smoke.body.results[0]?.reason).not.toBe("not_found");
      }

      // -- Warmup: prime TLS/H2 and the PoP's KV cache.
      for (let i = 0; i < WARMUPS; i++) {
        await evaluateOnce(`bench-warmup-${i}`);
      }

      // -- Measured run, sequential.
      const timings: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const sample = await evaluateOnce(`bench-user-${i}`);
        expect(sample.status).toBe(200);
        expect(Array.isArray(sample.body.results)).toBe(true);
        timings.push(sample.ms);
      }

      const sorted = [...timings].sort((a, b) => a - b);
      const p50 = percentile(sorted, 0.5);
      const p90 = percentile(sorted, 0.9);
      const p99 = percentile(sorted, 0.99);
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;

      const fmt = (n: number) => `${n.toFixed(1)}ms`;
      console.log("");
      console.log(`edge evaluate latency: ${EDGE_URL}`);
      console.log(
        `  target: ${FLAG_KEY ?? "(all flags)"} · samples: ${SAMPLES} · config v${smoke.body.version}`,
      );
      console.log(`  P50: ${fmt(p50)}   ← the number you asked for`);
      console.log(`  P90: ${fmt(p90)}`);
      console.log(`  P99: ${fmt(p99)}`);
      console.log(
        `  min: ${fmt(sorted[0])} · avg: ${fmt(avg)} · max: ${fmt(sorted[sorted.length - 1])}`,
      );

      if (P50_BUDGET_MS !== undefined) {
        expect(
          p50,
          `P50 ${fmt(p50)} exceeded budget ${P50_BUDGET_MS}ms`,
        ).toBeLessThanOrEqual(P50_BUDGET_MS);
      }
    });
  },
);
