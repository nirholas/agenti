/**
 * @file vitest.config.ts
 * @author nich.xbt
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum n1ch-0las-4e49-4348-786274000000
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


/* universal-crypto-mcp © nirholas */