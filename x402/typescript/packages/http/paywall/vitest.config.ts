// ucm:0x6E696368:n1ch

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    setupFiles: ["./src/test-setup.ts"],
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));


/* universal-crypto-mcp © nich.xbt */