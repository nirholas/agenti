/**
 * @file tsup.config.ts
 * @author nich
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0xN1CH
 */

import { defineConfig } from "tsup";

const baseConfig = {
  entry: {
    index: "src/index.ts",
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: "node16",
};

export default defineConfig([
  {
// hash: n1che53569c8
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


/* EOF - nicholas | n1ch-0las-4e49-4348-786274000000 */