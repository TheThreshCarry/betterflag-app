import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "../auth/auth-schema";
import * as appSchema from "./schema";
import * as DrizzleORM from "drizzle-orm";

// Merge both schemas for the drizzle instance
const schema = { ...authSchema, ...appSchema };

const db = drizzle(process.env.DATABASE_URL!, { schema });

export default db;
export { schema, authSchema, appSchema, DrizzleORM };