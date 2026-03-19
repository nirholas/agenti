import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Build configuration for static client-side React app
// Worker is built separately by Wrangler (src/server.ts)
//
// NOTE: We import 'agents/react' in the client, which is the Cloudflare Agents SDK.
// This SDK expects certain Cloudflare Worker constants to be defined at build time.
// We define them here for browser builds (they're undefined/null in production).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: "./index.html",
        mymcp: "./my-mcp.html"
      }
    }
  },
  define: {
    // Cloudflare Agents SDK expects these constants
    // __DEFINES__ must be an object (code does Object.keys() on it)
    '__DEFINES__': JSON.stringify({}),
    '__BASE__': JSON.stringify(undefined),
    '__SERVER_HOST__': JSON.stringify(undefined),
    '__HMR_BASE__': JSON.stringify(undefined),
    '__HMR_CONFIG_NAME__': JSON.stringify(undefined),
    '__HMR_PROTOCOL__': JSON.stringify(undefined),
    '__HMR_HOSTNAME__': JSON.stringify(undefined),
    '__HMR_PORT__': JSON.stringify(undefined),
    '__HMR_TIMEOUT__': JSON.stringify(undefined),
    '__HMR_DIRECT_TARGET__': JSON.stringify(undefined),
    '__HMR_ENABLE_OVERLAY__': 'false',
    '__WS_TOKEN__': JSON.stringify(undefined),
    '__DATE__': JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    dedupe: ["react", "react-dom"]
  }
});
