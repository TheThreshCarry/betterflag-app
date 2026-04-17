import type { Bindings } from "../types";

/**
 * Tinybird event ingestion client for the worker.
 *
 * POSTs NDJSON to `{host}/v0/events?name={datasource}`. Fire-and-forget —
 * call wrapped in `ctx.waitUntil(sendEvents(...))` to avoid blocking the
 * response.
 */
export async function sendEvents(
  env: Bindings,
  datasource: "flag_evaluations" | "events",
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  const host = env.TINYBIRD_HOST;
  const token = env.TINYBIRD_INGEST_TOKEN;
  if (!host || !token) {
    console.warn("[tinybird] host or token missing — skipping ingest");
    return;
  }
  if (rows.length === 0) return;

  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  const url = `${host.replace(/\/$/, "")}/v0/events?name=${encodeURIComponent(datasource)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-ndjson",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[tinybird] ingest failed datasource=${datasource} status=${res.status} body=${text}`,
      );
    }
  } catch (err) {
    console.error(`[tinybird] ingest threw datasource=${datasource}:`, err);
  }
}
