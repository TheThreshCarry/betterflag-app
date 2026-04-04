import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

export async function setup() {
  config({ path: resolve(__dirname, "../../../.env.test") });

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set. Run `bun run test:db:setup` to start the test database."
    );
  }

  try {
    execSync(
      `DATABASE_URL=${url} bunx drizzle-kit migrate`,
      { cwd: resolve(__dirname, "../../.."), stdio: "pipe" }
    );
  } catch (err) {
    console.error("Failed to run migrations. Is the test DB running?");
    throw err;
  }
}

export async function teardown() {
  // Pool cleanup happens in per-file setup
}
