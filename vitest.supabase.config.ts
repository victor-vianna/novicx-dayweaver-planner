// End-to-end checks of the Supabase services against the LOCAL stack.
// Usage: npm run db:reset && npm run test:supabase
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.it.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
