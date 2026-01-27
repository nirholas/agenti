/**
 * @file vite-env.d.ts
 * @author nich.xbt
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0.4.14.3
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CDP_PROJECT_ID: string;
  readonly VITE_CDP_BASE_PATH: string;
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


/* universal-crypto-mcp © universal-crypto-mcp */