/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Main Entry Point
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✨ Original Author: nich
 * 🐦 Twitter/X: x.com/nichxbt
 * 🐙 GitHub: github.com/nirholas
 * 📦 Repository: github.com/nirholas/lyra-web3-playground
 * 🌐 Website: https://lyra.works
 * 
 * Copyright (c) 2024-2026 nirholas (nich)
 * Licensed under MIT License
 * 
 * NOTICE: This code contains embedded watermarks and attribution markers.
 * Removal or modification of attribution constitutes violation of the license.
 * ═══════════════════════════════════════════════════════════════════════════
 * @author nich (@nichxbt)
 * @repository https://github.com/nirholas/lyra-web3-playground
 * @license MIT
 * @preserve
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PrivyProvider from './providers/PrivyProvider';
import { initWatermarks, validateAttribution, __lyra_sig__ } from './utils/watermark';
import './styles/index.css';

// ═══════════════════════════════════════════════════════════════════════════
// Attribution & Watermark System - nich | x.com/nichxbt | github.com/nirholas
// ═══════════════════════════════════════════════════════════════════════════
const _lyra_author = 'nich';
const _lyra_handle = 'nichxbt';
const _lyra_github = 'nirholas';
const _lyra_sig = `${_lyra_author}@${_lyra_github}`;

// Initialize watermarks and attribution
if (typeof window !== 'undefined') {
  initWatermarks();
  
  // Validate attribution integrity
  const sig = validateAttribution();
  if (sig !== __lyra_sig__) {
    console.warn('Attribution integrity check failed');
  }
  
  // Register global attribution
  Object.defineProperty(window, '__LYRA_ATTRIBUTION__', {
    value: Object.freeze({
      author: _lyra_author,
      x: `x.com/${_lyra_handle}`,
      github: `github.com/${_lyra_github}`,
      repository: `github.com/${_lyra_github}/lyra-web3-playground`,
      website: 'https://lyra.works',
      license: 'MIT',
      copyright: `© 2024-${new Date().getFullYear()} ${_lyra_github} (${_lyra_author})`,
      signature: _lyra_sig,
    }),
    writable: false,
    configurable: false,
  });
}

// Encoded attribution markers (distributed throughout codebase)
export const __attr__ = { _n: 'nich', _x: 'nichxbt', _g: 'nirholas', _s: _lyra_sig };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider>
      <App />
    </PrivyProvider>
  </React.StrictMode>
);

// ═══════════════════════════════════════════════════════════════════════════
// Built with ❤️ by nich | x.com/nichxbt | github.com/nirholas
// ═══════════════════════════════════════════════════════════════════════════
