/**
 * @file vite.config.ts
 * @author @nichxbt
 * @copyright (c) 2026 n1ch0las
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0xN1CH
 */

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    headers: {
      // Allow all origins in development to support localhost x402 requests
      "Access-Control-Allow-Origin": "*",
    },
  },
  build: {
    outDir: "dist",
  },
  base: "",
});


/* universal-crypto-mcp © nicholas */