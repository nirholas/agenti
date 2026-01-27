import * as esbuild from 'esbuild';
import { writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bundle the wallet library with Node.js polyfills for browser
const result = await esbuild.build({
    entryPoints: [join(__dirname, 'src/wallet.js')],
    bundle: true,
    format: 'iife',
    globalName: 'EthWallet',
    write: false,
    minify: false,
    target: ['es2020'],
    platform: 'browser',
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis'
    },
    inject: [],
    alias: {
        'events': 'events',
        'buffer': 'buffer'
    }
});

const bundledJS = result.outputFiles[0].text;

// Read HTML template
const template = readFileSync(join(__dirname, 'template.html'), 'utf8');

// Inject bundled JS
const finalHTML = template.replace('/* BUNDLED_WALLET_CODE */', bundledJS);

// Write output
const outputPath = join(__dirname, '..', 'offline1.html');
writeFileSync(outputPath, finalHTML);

console.log('✓ Built offline1.html with official ethereumjs libraries');
console.log('  Bundle size:', Math.round(bundledJS.length / 1024), 'KB');
