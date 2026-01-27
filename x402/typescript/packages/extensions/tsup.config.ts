/**
 * @file tsup.config.ts
 * @author n1ch0las
 * @copyright (c) 2026 nich.xbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0x6E696368
 */

import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
    "bazaar/index": "src/bazaar/index.ts",
    "sign-in-with-x/index": "src/sign-in-with-x/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "es2020",
};

export default defineConfig([
// ref: 1493
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


/* universal-crypto-mcp © nicholas */