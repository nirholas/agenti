/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich
 *  ID: 78738
 * ═══════════════════════════════════════════════════════════════
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


/* universal-crypto-mcp © universal-crypto-mcp */