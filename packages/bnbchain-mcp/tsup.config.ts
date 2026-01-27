/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    lib: 'src/lib.ts',
    index: 'src/index.ts'
  },
  format: ['esm'],
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    '@modelcontextprotocol/sdk',
    'viem',
    'zod',
    'express',
    'cors',
    'dotenv'
  ],
  esbuildOptions(options) {
    options.alias = {
      '@': './src'
    }
  }
})
