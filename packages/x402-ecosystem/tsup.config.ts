/* tsup.config.ts | nich | 1414930800 */

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    agent: "src/agent.ts",
    marketplace: "src/marketplace.ts",
    premium: "src/premium.ts",
    yield: "src/yield.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["@modelcontextprotocol/sdk"],
});


/* universal-crypto-mcp © nirholas */