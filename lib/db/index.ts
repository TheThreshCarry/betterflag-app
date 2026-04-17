import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as appSchema from "./schema";
import * as DrizzleORM from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("db");

const schema = { ...appSchema };

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof drizzle>;
};

function createDb() {
  log.info("connecting to PostgreSQL");
  return drizzle(process.env.DATABASE_URL!, { schema });
}

const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export default db;
export { schema, appSchema, DrizzleORM };
