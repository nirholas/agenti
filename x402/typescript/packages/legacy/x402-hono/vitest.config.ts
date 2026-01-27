// ucm:0x4E494348:n1ch

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ""),
  },
  plugins: [tsconfigPaths({ projects: ["."] })],
}));


/* universal-crypto-mcp © nich */