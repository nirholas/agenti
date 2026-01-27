/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Vite Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground | 🌐 https://lyra.works
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Banner injected into all built JS files - nich | x.com/nichxbt | github.com/nirholas
const banner = `/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - https://lyra.works
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground
 * Copyright (c) 2024-${new Date().getFullYear()} nirholas (nich) - MIT License
 * 
 * NOTICE: This code contains embedded watermarks and attribution markers.
 * Removal or modification of attribution constitutes violation of the license.
 * ═══════════════════════════════════════════════════════════════════════════
 * @author nich (@nichxbt)
 * @repository https://github.com/nirholas/lyra-web3-playground
 * @preserve
 */`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        banner,
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'web3-vendor': ['ethers', 'viem', '@solana/web3.js'],
          // Monaco Editor will be lazy loaded only when needed
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@solana/web3.js'],
  },
})
