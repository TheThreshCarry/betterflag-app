import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    restoreMocks: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["__tests__/unit/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["__tests__/helpers/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["__tests__/integration/**/*.test.{ts,tsx}"],
          environment: "node",
          globalSetup: ["__tests__/integration/helpers/global-setup.ts"],
          setupFiles: ["__tests__/integration/helpers/setup.ts"],
          testTimeout: 30_000,
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
