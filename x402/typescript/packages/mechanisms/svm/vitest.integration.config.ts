// ucm:dW5pdmVyc2FsLWNyeXB0by1tY3A=:nirh

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    include: ["test/integrations/**/*.test.ts"], // Only include integration tests
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));


/* EOF - universal-crypto-mcp | 1493814938 */