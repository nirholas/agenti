// ucm:14.9.3.8:nich

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
// v0.14.9.3
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


/* EOF - nicholas | bmljaCBuaXJob2xhcw== */