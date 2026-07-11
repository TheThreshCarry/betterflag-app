/**
 * ITR-62 Phase 0: assemble bench partials into the committed baseline.
 *
 * Reads bench-results/partials/*.json (written by insert-bench.mjs and
 * query-bench.mjs) and writes:
 *   bench-results/clickhouse-baseline.json
 *   bench-results/clickhouse-baseline.md
 *
 * Usage: node report.mjs [--out clickhouse-baseline]
 *
 * ClickHouse Cloud compute active-hours + cost for the bench window cannot
 * be read from SQL; fill `cloudCost` manually from the CH Cloud console
 * (Usage page, filter to the insert window recorded in the JSON).
 */

import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { parseArgs, writePartial } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const outName = args["out"] ?? "clickhouse-baseline";

const partialsDir = "bench-results/partials";
const partials = readdirSync(partialsDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(`${partialsDir}/${name}`, "utf8")));

const inserts = partials.filter((p) => p.bench === "insert");
const queries = partials.filter((p) => p.bench === "query");

let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  // fine, committed results carry their own sha anyway
}

const baseline = {
  issue: "ITR-62",
  backend: outName.startsWith("ae") ? "workers-analytics-engine" : "clickhouse-cloud",
  generatedAt: new Date().toISOString(),
  gitSha,
  inserts,
  queries,
  cloudCost: {
    note: "Fill manually from the ClickHouse Cloud console (Usage page) for the insert window.",
    computeActiveHours: null,
    costUsd: null,
  },
};

writePartial(`bench-results/${outName}.json`, baseline);

// ---------------------------------------------------------------------------
// Markdown summary
// ---------------------------------------------------------------------------

const lines = [];
lines.push(`# ${baseline.backend} benchmark (${outName})`);
lines.push("");
lines.push(`Generated ${baseline.generatedAt} at \`${gitSha}\` for ITR-62.`);
lines.push("");

if (inserts.length > 0) {
  lines.push("## Insert throughput");
  lines.push("");
  lines.push("| Mode | Events | Batch | Conc. | Rows/s | p50 | p95 | p99 | Retries | Failed batches |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const i of inserts) {
    const l = i.batchLatency;
    lines.push(
      `| ${i.label} | ${i.events.toLocaleString("en-US")} | ${i.batchSize} | ${i.concurrency} ` +
      `| ${i.rowsPerSecond.toLocaleString("en-US")} | ${l.p50Ms}ms | ${l.p95Ms}ms | ${l.p99Ms}ms ` +
      `| ${i.retries} | ${i.failedBatches} |`,
    );
  }
  lines.push("");
}

for (const q of queries) {
  lines.push(`## Queries (${q.label}, org \`${q.org}\`)`);
  lines.push("");
  lines.push("| Query | Cold | Warm p50 | Warm p95 | Rows |");
  lines.push("|---|---|---|---|---|");
  for (const [name, spec] of Object.entries(q.queries)) {
    if (name === "q5_concurrency") continue;
    lines.push(
      `| ${name} | ${spec.coldMs}ms | ${spec.warm.p50Ms}ms | ${spec.warm.p95Ms}ms | ${spec.rowsReturned} |`,
    );
  }
  const q5 = q.queries.q5_concurrency;
  if (q5) {
    lines.push(
      `| q5_concurrency (20x Q2) | - | ${q5.perQuery.p50Ms}ms | ${q5.perQuery.p95Ms}ms | - |`,
    );
    lines.push("");
    lines.push(
      `Q5 wall time per 20-query round: ${q5.rounds.map((r) => `${Math.round(r.wallMs)}ms`).join(", ")}.`,
    );
  }
  lines.push("");
}

lines.push("## Cloud cost");
lines.push("");
lines.push(
  "Compute active-hours and cost for the bench window are read manually from " +
  "the ClickHouse Cloud console and belong in `cloudCost` in the JSON.",
);
lines.push("");

import { writeFileSync } from "node:fs";
writeFileSync(`bench-results/${outName}.md`, lines.join("\n"));
console.log(`wrote bench-results/${outName}.md`);
