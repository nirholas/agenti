import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    globals: true,
    environment: "node",
    testTimeout: 60000,
  },
});
