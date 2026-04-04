import { createClient } from "@clickhouse/client";
import { createLogger } from "@/lib/logger";

const log = createLogger("clickhouse");

let client: ReturnType<typeof createClient> | null = null;

export function getClickHouseClient() {
  if (!client) {
    const database = process.env.CLICKHOUSE_DATABASE || "shipos_analytics";
    log.info({ database }, "creating ClickHouse client");
    client = createClient({
      url: process.env.CLICKHOUSE_URL!,
      username: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
      database,
    });
  }
  return client;
}
