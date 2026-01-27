/**
 * @file vitest.config.ts
 * @author nirholas
 * @copyright (c) 2026 universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 14.9.3.8
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


/* ucm:n1ch7e230225 */