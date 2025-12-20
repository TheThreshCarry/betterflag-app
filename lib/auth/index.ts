import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "../../lib/db";
import { lastLoginMethod, organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // or "pg" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [lastLoginMethod(), organization()],
});
