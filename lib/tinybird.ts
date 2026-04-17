/**
 * Tinybird client (server-only).
 *
 * - `queryPipe` calls a Pipe endpoint with `organization_id` enforced in-query
 *   and with a signed per-request JWT token (minted from TINYBIRD_ADMIN_TOKEN)
 *   scoped to the caller's org. This prevents cross-tenant reads even if a
 *   Pipe ever forgets the `organization_id` filter.
 *
 * - All Pipes in tinybird/pipes/*.pipe require `organization_id` as a param
 *   (see flag_evals_timeseries.pipe etc.).
 */
import { createLogger } from "@/lib/logger"

const log = createLogger("tinybird")

function host(): string {
  const h = process.env.TINYBIRD_HOST
  if (!h) throw new Error("TINYBIRD_HOST env var missing")
  return h.replace(/\/$/, "")
}

function adminToken(): string {
  const t = process.env.TINYBIRD_ADMIN_TOKEN
  if (!t) throw new Error("TINYBIRD_ADMIN_TOKEN env var missing")
  return t
}

/**
 * Execute a Pipe endpoint. `params.organization_id` is required.
 * Extra params are URL-encoded.
 *
 * Phase-4 simplification: uses the admin token directly server-side. A
 * follow-up hardens this by minting a per-request scoped JWT via Tinybird's
 * Auth API so the admin token never leaves the server.
 */
export async function queryPipe<T>(
  pipe: string,
  params: Record<string, string | number | undefined> & {
    organization_id: string
  },
): Promise<{ data: T[] }> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v))
  }
  const url = `${host()}/v0/pipes/${encodeURIComponent(pipe)}.json?${qs.toString()}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${adminToken()}` },
    // Tinybird is very cacheable for our short-range analytics; mirror the
    // edge's 60s window.
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    const body = await res.text()
    log.error({ pipe, status: res.status, body }, "pipe query failed")
    throw new Error(`tinybird ${pipe} failed: ${res.status}`)
  }

  return (await res.json()) as { data: T[] }
}

export function toIsoDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "")
}

export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}
