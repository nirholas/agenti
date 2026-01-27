#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Code Attribution Injector
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This script adds attribution headers to all source files.
 * Run: node scripts/inject-attribution.js
 * 
 * ✨ Author: nich | x.com/nichxbt | github.com/nirholas
 * Copyright (c) 2024-2026 nirholas - MIT License
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const AUTHOR = 'nich';
const TWITTER = 'x.com/nichxbt';
const GITHUB = 'github.com/nirholas';
const REPO = 'github.com/nirholas/lyra-web3-playground';
const WEBSITE = 'https://lyra.works';
const YEAR = new Date().getFullYear();

// Header templates
const jsHeader = `/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: ${AUTHOR} | 🐦 ${TWITTER} | 🐙 ${GITHUB}
 * 📦 ${REPO}
 * 🌐 ${WEBSITE}
 * 
 * Copyright (c) 2024-${YEAR} nirholas (${AUTHOR}) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

`;

const cssHeader = `/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Styles
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: ${AUTHOR} | 🐦 ${TWITTER} | 🐙 ${GITHUB}
 * 📦 ${REPO} | 🌐 ${WEBSITE}
 * Copyright (c) 2024-${YEAR} nirholas (${AUTHOR}) - MIT License
 * ═══════════════════════════════════════════════════════════════════════════
 */

`;

const htmlComment = `<!--
═══════════════════════════════════════════════════════════════════════════
LYRA WEB3 PLAYGROUND
═══════════════════════════════════════════════════════════════════════════
✨ Author: ${AUTHOR} | 🐦 ${TWITTER} | 🐙 ${GITHUB}
📦 ${REPO}
🌐 ${WEBSITE}
Copyright (c) 2024-${YEAR} nirholas (${AUTHOR}) - MIT License
═══════════════════════════════════════════════════════════════════════════
-->
`;

// Check if file already has attribution
const hasAttribution = (content) => {
  return content.includes('nirholas') || 
         content.includes('nichxbt') ||
         content.includes('LYRA WEB3 PLAYGROUND') ||
         content.includes('built by nich');
};

// Process a single file
const processFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has attribution
  if (hasAttribution(content)) {
    console.log(`⏭️  Skipping (already attributed): ${filePath}`);
    return false;
  }
  
  let header = '';
  
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      header = jsHeader;
      break;
    case '.css':
    case '.scss':
    case '.less':
      header = cssHeader;
      break;
    case '.html':
      // Insert after <!DOCTYPE html> if present
      if (content.toLowerCase().startsWith('<!doctype')) {
        const doctypeEnd = content.indexOf('>') + 1;
        content = content.slice(0, doctypeEnd) + '\n' + htmlComment + content.slice(doctypeEnd);
      } else {
        content = htmlComment + content;
      }
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated: ${filePath}`);
      return true;
    default:
      return false;
  }
  
  if (header) {
    fs.writeFileSync(filePath, header + content);
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  
  return false;
};

// Recursively find all source files
const findFiles = (dir, files = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, dist, .git, etc.
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage', '.vite'].includes(entry.name)) {
        findFiles(fullPath, files);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.mjs', '.cjs'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
};

// Main
const main = () => {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('LYRA WEB3 PLAYGROUND - Attribution Injector');
  console.log(`Author: ${AUTHOR} | ${TWITTER} | ${GITHUB}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const rootDir = path.resolve(__dirname, '..');
  const files = findFiles(rootDir);
  
  let updated = 0;
  let skipped = 0;
  
  for (const file of files) {
    if (processFile(file)) {
      updated++;
    } else {
      skipped++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`✅ Updated: ${updated} files`);
  console.log(`⏭️  Skipped: ${skipped} files (already attributed)`);
  console.log('═══════════════════════════════════════════════════════════════════');
};

main();
