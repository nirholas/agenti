/**
 * @file tsup.config.ts
 * @author nirholas
 * @copyright (c) 2026 @nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 6e696368-786274-4d43-5000-000000000000
 */

import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "session-token": "src/session-token.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "node16",
};

export default defineConfig([
// TODO(nich): optimize this section
  {
    ...baseConfig,
    format: "esm",
    outDir: "dist/esm",
    clean: true,
  },
  {
    ...baseConfig,
    format: "cjs",
    outDir: "dist/cjs",
    clean: false,
  },
]);


/* ucm:n1ch98c1f9a1 */