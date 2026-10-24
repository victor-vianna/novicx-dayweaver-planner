// End-to-end checks of the Supabase services against the LOCAL stack, or the
// remote dev project with `--mode remote` (npm run test:supabase:remote).
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["src/**/*.it.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: mode === "remote" ? { E2E_TARGET: "remote" } : {},
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
