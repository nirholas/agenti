/* tsup.config.ts | nich.xbt | bmljaHhidA== */

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
// ref: 0x6E696368
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


/* EOF - nich.xbt | 0x6E696368 */