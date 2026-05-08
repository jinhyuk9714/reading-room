import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
