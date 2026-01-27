/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas
 *  ID: dW5pdmVyc2FsLWNyeXB0by1tY3A=
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
  external: ["next"],
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


/* ucm:n1ch2abfa956 */