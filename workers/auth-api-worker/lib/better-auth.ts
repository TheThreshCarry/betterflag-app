import { auth as shipOsBetterAuth } from "../../../lib/auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import db from "../../../lib/db";
/**
 * Better Auth Instance
 */
export const auth = (
  env: CloudflareBindings
): ReturnType<typeof betterAuth> => {
  return betterAuth({
    ...shipOsBetterAuth,
    database: drizzleAdapter(db, { provider: "pg" }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
  });
};
