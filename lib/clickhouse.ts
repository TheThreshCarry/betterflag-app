import { createClient } from "@clickhouse/client";

/**
 * ClickHouse client singleton for use in Next.js server actions.
 *
 * Uses @clickhouse/client (Node.js version) which supports connection pooling
 * and Keep-Alive. A singleton is used to reuse connections across requests.
 */
let client: ReturnType<typeof createClient> | null = null;

export function getClickHouseClient() {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL!,
      username: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
      database: process.env.CLICKHOUSE_DATABASE || "shipos_analytics",
    });
  }
  return client;
}
