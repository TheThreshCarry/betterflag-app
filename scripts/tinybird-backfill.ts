#!/usr/bin/env bun
/**
 * Tinybird backfill — export historical flag_evaluations from ClickHouse
 * to NDJSON, then bulk-import into Tinybird.
 *
 * Usage:
 *   # 1) Dump from ClickHouse to ./tinybird-backfill/flag_evaluations.ndjson
 *   bun run scripts/tinybird-backfill.ts dump --out ./tinybird-backfill
 *
 *   # 2) Push the NDJSON into Tinybird's flag_evaluations datasource
 *   bun run scripts/tinybird-backfill.ts push --in ./tinybird-backfill --datasource flag_evaluations
 *
 * Run step 1 from a host that still has CLICKHOUSE_* creds (before we rip
 * the env out). Run step 2 afterwards; idempotent if you use Tinybird's
 * `mode=append`.
 */
import "dotenv/config"
import { createReadStream } from "node:fs"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const mode = process.argv[2]
const arg = (k: string) => {
  const i = process.argv.findIndex((a) => a === `--${k}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function dump() {
  const out = arg("out") ?? "./tinybird-backfill"
  await mkdir(out, { recursive: true })

  const chUrl = process.env.CLICKHOUSE_URL
  const chUser = process.env.CLICKHOUSE_USER ?? "default"
  const chPass = process.env.CLICKHOUSE_PASSWORD ?? ""
  const chDb = process.env.CLICKHOUSE_DATABASE ?? "shipos_analytics"
  if (!chUrl) {
    console.error("CLICKHOUSE_URL not set — cannot dump")
    process.exit(1)
  }

  const query = `
    SELECT
      organization_id, environment, customer_id, flag_key,
      toInt32(flag_value) AS flag_value,
      formatDateTime(timestamp, '%Y-%m-%dT%H:%M:%S') AS timestamp,
      country, city, region, continent,
      latitude, longitude, timezone,
      user_agent, sdk_version, request_id
    FROM ${chDb}.feature_flag_evaluations
    FORMAT JSONEachRow
  `

  const res = await fetch(`${chUrl}?query=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${chUser}:${chPass}`).toString("base64")}`,
    },
  })
  if (!res.ok || !res.body) {
    console.error(`clickhouse dump failed: ${res.status}`)
    process.exit(1)
  }

  const outPath = join(out, "flag_evaluations.ndjson")
  const text = await res.text()
  await writeFile(outPath, text, "utf8")
  console.log(`[backfill] wrote ${outPath} (${text.length} bytes)`)
}

async function push() {
  const inDir = arg("in") ?? "./tinybird-backfill"
  const datasource = arg("datasource") ?? "flag_evaluations"
  const host = process.env.TINYBIRD_HOST
  const token = process.env.TINYBIRD_INGEST_TOKEN ?? process.env.TINYBIRD_ADMIN_TOKEN
  if (!host || !token) {
    console.error("TINYBIRD_HOST + TINYBIRD_INGEST_TOKEN (or ADMIN) required")
    process.exit(1)
  }

  const files = (await readdir(inDir)).filter((f) => f.endsWith(".ndjson"))
  for (const f of files) {
    const stream = createReadStream(join(inDir, f))
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)

    const url = `${host.replace(/\/$/, "")}/v0/datasources?name=${encodeURIComponent(datasource)}&mode=append&format=ndjson`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[backfill] push failed (${f}): ${res.status} ${text}`)
      process.exit(1)
    }
    console.log(`[backfill] pushed ${f}: ${text}`)
  }
}

if (mode === "dump") {
  await dump()
} else if (mode === "push") {
  await push()
} else {
  console.log(`Usage:
  bun run scripts/tinybird-backfill.ts dump --out ./tinybird-backfill
  bun run scripts/tinybird-backfill.ts push --in ./tinybird-backfill --datasource flag_evaluations
`)
  process.exit(mode ? 1 : 0)
}
