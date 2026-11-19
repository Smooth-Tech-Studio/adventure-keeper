import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/src/**/*.test.ts"],
  },
});
