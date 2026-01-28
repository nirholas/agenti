#!/usr/bin/env node
/**
 * Generate simple PNG logos for awesome-openrouter submission
 * Creates 128x128 solid color PNGs with valid PNG structure
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// App configurations with colors
const apps = [
  { name: 'agenti', color: [99, 102, 241] },           // Indigo
  { name: 'xactions', color: [29, 161, 242] },         // Twitter Blue
  { name: 'free-crypto-news', color: [16, 185, 129] }, // Emerald
  { name: 'crypto-data-aggregator', color: [139, 92, 246] }, // Purple
  { name: 'lyra-tool-discovery', color: [236, 72, 153] },    // Pink
  { name: 'lyra-intel', color: [245, 158, 11] },       // Amber
  { name: 'lyra-web3-playground', color: [6, 182, 212] },    // Cyan
  { name: 'defi-agents', color: [34, 197, 94] },       // Green
  { name: 'binance-mcp', color: [240, 185, 11] },      // Binance Yellow
  { name: 'binance-us-mcp', color: [240, 185, 11] },   // Binance Yellow
  { name: 'bnbchain-mcp', color: [240, 185, 11] },     // Binance Yellow
  { name: 'mcp-notify', color: [239, 68, 68] },        // Red
  { name: 'lyra-registry', color: [168, 85, 247] },    // Violet
  { name: 'ai-agents-library', color: [59, 130, 246] }, // Blue
  { name: 'github-to-mcp', color: [31, 41, 55] },      // Gray Dark
  { name: 'plugin-delivery', color: [249, 115, 22] },  // Orange
  { name: 'extract-llms-docs', color: [20, 184, 166] }, // Teal
  { name: 'sperax-crypto-mcp', color: [99, 102, 241] }, // Indigo
  { name: 'ucai', color: [147, 51, 234] },             // Purple
  { name: 'universal-crypto-mcp', color: [79, 70, 229] }, // Indigo
];

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  
  return Buffer.concat([length, typeAndData, crc]);
}

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(2, 9);  // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk('IHDR', ihdrData);
  
  // Create raw image data (filter byte + RGB for each row)
  const rowSize = 1 + width * 3; // filter byte + RGB
  const rawData = Buffer.alloc(height * rowSize);
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter type: None
    
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }
  
  // Compress with zlib
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Generate logos
const appsDir = path.join(__dirname, '..', 'awesome-openrouter-pr', 'apps');

for (const app of apps) {
  const logoPath = path.join(appsDir, app.name, 'logo.png');
  const [r, g, b] = app.color;
  
  const png = createPNG(128, 128, r, g, b);
  fs.writeFileSync(logoPath, png);
  console.log(`✅ Created ${app.name}/logo.png (${r}, ${g}, ${b})`);
}

console.log(`\n🎉 Generated ${apps.length} logos!`);
