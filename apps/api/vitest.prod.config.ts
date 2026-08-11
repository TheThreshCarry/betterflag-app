import { defineConfig } from "vitest/config";

// Production smoke + latency suite. Requires BETTERFLAG_PROD_SDK_KEY.
// Run with: bun run test:prod
export default defineConfig({
  test: {
    include: ["test-prod/**/*.test.ts"],
    // 100+ sequential network round-trips; give it room.
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
