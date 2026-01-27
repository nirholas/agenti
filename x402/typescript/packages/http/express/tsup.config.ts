/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
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
// id: n1ch-0las-4e4
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