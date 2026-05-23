import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: [
      "node_modules/**",
      "lobster-src/**",
      "src/lib/executor/claw-code.test.mjs",
      "src/lib/home-command-center.test.mjs",
    ],
  },
});
