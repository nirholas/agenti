/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nichxbt
 *  ID: 1493814938
 * ═══════════════════════════════════════════════════════════════
 */

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));


/* universal-crypto-mcp © n1ch0las */