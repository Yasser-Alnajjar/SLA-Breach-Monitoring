import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/web/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirrors apps/web/tsconfig.json's "@/*" path mapping — needed so tests
      // under apps/web/test can import modules (like proxy.ts) that use the
      // alias internally, without duplicating Next's own webpack/SWC config.
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
