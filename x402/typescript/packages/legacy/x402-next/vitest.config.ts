/**
 * @file vitest.config.ts
 * @author n1ch0las
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum bmljaCBuaXJob2xhcw==
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


/* universal-crypto-mcp © @nichxbt */