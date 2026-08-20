import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirror tsconfig paths: published exports point at dist (bun publish), but
// in-repo tests run against SDK source so we don't need a prior tsup build.
export default defineConfig({
  resolve: {
    alias: {
      "@betterflag/sdk": fileURLToPath(new URL("../sdk-js/src/index.ts", import.meta.url)),
    },
  },
});
