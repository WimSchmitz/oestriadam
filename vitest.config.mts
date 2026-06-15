import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // All tests are pure logic (no DOM), so the lightweight node environment
    // avoids jsdom's ESM CSS-parser incompatibility under Vitest 4.
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
