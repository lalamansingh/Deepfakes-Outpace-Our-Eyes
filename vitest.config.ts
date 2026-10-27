import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Every test file gets its own in-memory Postgres.
    env: { PGLITE_DIR: "memory://", SESSION_SECRET: "test-secret-test-secret-test-secret-123", NODE_ENV: "test" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/server/**", "src/lib/contracts.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
