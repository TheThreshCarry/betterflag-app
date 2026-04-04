import { createClient } from "@clickhouse/client-web";
import type { Bindings } from "../types";

/**
 * Create a ClickHouse web client for use in Cloudflare Workers.
 *
 * Uses @clickhouse/client-web which is compatible with the Workers runtime
 * (fetch-based, no Node.js APIs required).
 *
 * async_insert + wait_for_async_insert=0 lets ClickHouse batch individual
 * inserts server-side, which is the recommended approach for high-frequency
 * writes from serverless environments.
 */
export function createClickHouseClient(env: Bindings) {
  return createClient({
    url: env.CLICKHOUSE_URL,
    username: env.CLICKHOUSE_USER,
    password: env.CLICKHOUSE_PASSWORD,
    database: env.CLICKHOUSE_DATABASE || "shipos_analytics",
    clickhouse_settings: {
      async_insert: 1,
      wait_for_async_insert: 0,
    },
  });
}
