import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Suites that run against the real Postgres at TEST_DATABASE_URL. Each one
// truncates every table between tests, so two running at once wipe each
// other's data: they get their own project, one file at a time, after the rest.
const realDatabaseSuites = [
  "apps/web/test/tenant-isolation.test.ts",
  "apps/web/test/source-sync-evaluation.test.ts",
  "apps/web/test/evaluation-persistence.test.ts",
  "apps/web/test/multi-commitment-pipeline.test.ts",
  "apps/web/test/event-ordering-persistence.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["packages/*/test/**/*.test.ts", "apps/web/test/**/*.test.ts", "apps/worker/test/**/*.test.ts", "apps/concierge/test/**/*.test.ts"],
          exclude: realDatabaseSuites,
        },
      },
      {
        extends: true,
        test: {
          name: "real-database",
          include: realDatabaseSuites,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
  // apps/web's tsconfig keeps JSX as-is for Next to compile; tests that
  // render a component need it compiled here instead.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      // Mirrors apps/web/tsconfig.json's "@/*" path mapping — needed so tests
      // under apps/web/test can import modules (like proxy.ts) that use the
      // alias internally, without duplicating Next's own webpack/SWC config.
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
