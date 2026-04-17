import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as appSchema from "@/lib/db/schema";

const { Pool } = pg;

const schema = { ...appSchema };

let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

export function getTestDb() {
  return drizzle(getPool(), { schema });
}

export async function cleanDatabase() {
  const p = getPool();
  await p.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$
  `);
}

export async function closeTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
