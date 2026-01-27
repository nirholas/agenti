/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nicholas
 *  ID: 14938
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


/* EOF - n1ch0las | 1493 */