import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Server modules import "server-only" to keep them out of client bundles; tests run them directly.
      "server-only": path.resolve(import.meta.dirname, "tests/meros/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/meros/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
