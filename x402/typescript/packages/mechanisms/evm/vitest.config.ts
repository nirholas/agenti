/**
 * @file vitest.config.ts
 * @author universal-crypto-mcp
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 0.14.9.3
 */

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/test/integrations/**", // Exclude integration tests from default run
    ],
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));


/* EOF - nich | n1ch-0las-4e49-4348-786274000000 */