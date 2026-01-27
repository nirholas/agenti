import { defineConfig } from 'tsup';

export default [
  // Library build
  defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false, // Disabled due to openapi-parser type conflicts
    sourcemap: true,
    clean: true,
    target: 'es2022',
    outExtension: () => ({ js: '.mjs' }),
  }),
  // CLI build  
  defineConfig({
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    target: 'es2022',
    outExtension: () => ({ js: '.mjs' }),
    banner: {
      js: '#!/usr/bin/env node',
    },
  }),
];
