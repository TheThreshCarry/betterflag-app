import { defineConfig } from "vitest/config";

// Unit tests only. The production smoke/latency suite lives in test-prod/
// and runs via `bun run test:prod` (vitest.prod.config.ts) so that plain
// `vitest run` never hits production.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
