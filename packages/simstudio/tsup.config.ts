import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'tools/index': 'src/tools/index.ts',
    'blocks/index': 'src/blocks/index.ts',
    server: 'src/server.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@agenti/sdk', '@agenti/core'],
})
