/**
 * ITR-62 Phase 0: remove synthetic bench data from ClickHouse.
 *
 * Deletes rows for org_id LIKE 'bench%' (covers bench-org-* and
 * benchbig-org-*) from the raw `evaluations` table and from the inner
 * tables of the three SummingMergeTree materialized views. Real customer
 * org ids are UUIDs, so the prefix can never match production data.
 *
 * Usage:
 *   node --env-file=../../apps/dashboard/.env.local cleanup.mjs --dry-run
 *   node --env-file=../../apps/dashboard/.env.local cleanup.mjs
 */

import { chCommand, chQuery, clickhouseEnv, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const dryRun = args["dry-run"] === true;
const ch = clickhouseEnv();

const MATERIALIZED_VIEWS = [
  "evals_per_org_day",
  "evals_per_flag_hour",
  "evals_per_flag_country_hour",
];

/** MVs created without TO store rows in `.inner_id.{uuid}` tables. */
async function innerTableOf(view) {
  const { rows } = await chQuery(
    ch,
    `SELECT uuid FROM system.tables WHERE database = currentDatabase() AND name = {name:String}`,
    { name: view },
  );
  if (rows.length === 0) return null;
  return `\`.inner_id.${rows[0].uuid}\``;
}

async function benchRowCount(table) {
  const { rows } = await chQuery(
    ch,
    `SELECT count() AS c FROM ${table} WHERE org_id LIKE 'bench%'`,
  );
  return Number(rows[0]?.c ?? 0);
}

const targets = [{ name: "evaluations", table: "evaluations" }];
for (const view of MATERIALIZED_VIEWS) {
  const inner = await innerTableOf(view);
  if (inner === null) {
    console.warn(`skipping ${view}: not found in system.tables`);
    continue;
  }
  targets.push({ name: view, table: inner });
}

for (const target of targets) {
  const count = await benchRowCount(target.table);
  if (count === 0) {
    console.log(`${target.name}: no bench rows`);
    continue;
  }
  if (dryRun) {
    console.log(`${target.name}: would delete ${count.toLocaleString()} bench rows`);
    continue;
  }
  console.log(`${target.name}: deleting ${count.toLocaleString()} bench rows...`);
  // Lightweight delete; mutations_sync=0 returns immediately, ClickHouse
  // finishes the mutation in the background.
  await chCommand(ch, `DELETE FROM ${target.table} WHERE org_id LIKE 'bench%'`);
}

console.log(dryRun ? "dry run complete" : "cleanup submitted (mutations run in background)");
