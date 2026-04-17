/**
 * withKvSync — Higher-order function that wraps a server action so that,
 * after the action's database write commits, one or more Cloudflare KV
 * writes are fired. Failures are logged and enqueued into
 * public.kv_sync_retries; the original action's result is still returned.
 *
 * Usage:
 *   export const createFlag = withKvSync(_createFlag, {
 *     sync: ({ organizationId }) => [
 *       { operation: "put", key: KVKeys.flagsTenant(organizationId), payload: { ... } },
 *     ],
 *   })
 *
 * Rationale: Rule R2 requires every mutation to immediately sync KV. Making
 * this declarative keeps sync logic out of business code and makes it
 * trivial to audit every write path.
 */
import { createLogger } from "@/lib/logger"
import { enqueueKvRetry } from "./kv-sync"

const log = createLogger("with-kv-sync")

type KvOp =
  | { operation: "put"; key: string; payload: unknown }
  | { operation: "delete"; key: string }

type SyncResolver<T> = (result: T) => KvOp[] | Promise<KvOp[]>

async function applyOp(op: KvOp): Promise<boolean> {
  const workerUrl = process.env.WORKER_API_URL
  const secret = process.env.SERVICE_SECRET
  if (!workerUrl || !secret) {
    log.warn("WORKER_API_URL or SERVICE_SECRET missing — kv op skipped")
    return false
  }
  const url = `${workerUrl}/internal/kv/${encodeURIComponent(op.key)}`
  const res = await fetch(url, {
    method: op.operation === "put" ? "PUT" : "DELETE",
    headers: {
      "x-service-secret": secret,
      ...(op.operation === "put" ? { "Content-Type": "application/json" } : {}),
    },
    body: op.operation === "put" ? JSON.stringify(op.payload) : undefined,
  })
  return res.ok
}

export function withKvSync<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  opts: { sync: SyncResolver<TResult>; name?: string },
): (...args: TArgs) => Promise<TResult> {
  const label = opts.name ?? action.name ?? "action"
  return async (...args: TArgs): Promise<TResult> => {
    const result = await action(...args)
    try {
      const ops = await opts.sync(result)
      await Promise.all(
        ops.map(async (op) => {
          try {
            const ok = await applyOp(op)
            if (!ok) {
              log.warn({ label, key: op.key, op: op.operation }, "kv sync failed — enqueuing retry")
              await enqueueKvRetry(op)
            }
          } catch (err) {
            log.error({ label, err, key: op.key }, "kv sync threw — enqueuing retry")
            await enqueueKvRetry(op)
          }
        }),
      )
    } catch (err) {
      log.error({ label, err }, "sync resolver threw")
    }
    return result
  }
}
