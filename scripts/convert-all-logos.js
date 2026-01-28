const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logosDir = '/workspaces/agenti/logos';
const appsDir = '/workspaces/agenti/awesome-openrouter-pr/apps';

// Map logos to apps (picking from available files)
const mapping = {
  'agenti': '1.jpg',
  'xactions': 'xactions.jpg',
  'free-crypto-news': 'news.jpg',
  'binance-mcp': '2.jpg',
  'binance-us-mcp': '3.jpg',
  'bnbchain-mcp': '4.jpg',
  'universal-crypto-mcp': '5.jpg',
  'sperax-crypto-mcp': '6.jpg',
  'github-to-mcp': '7.jpg',
  'lyra-tool-discovery': '8.jpg',
  'lyra-intel': '9.jpg',
  'lyra-web3-playground': '11.jpg',
  'lyra-registry': '12.jpg',
  'crypto-data-aggregator': '23.jpg',
  'mcp-notify': '24.jpg',
  'plugin-delivery': '32.jpg',
  'defi-agents': '43.jpg',
  'extract-llms-docs': '53.jpg',
  'shakespeare': '55.jpg',
  'quests': '76.jpg'
};

async function convertAll() {
  for (const [app, logoFile] of Object.entries(mapping)) {
    const input = path.join(logosDir, logoFile);
    const output = path.join(appsDir, app, 'logo.png');
    
    try {
      await sharp(input)
        .resize(128, 128)
        .png()
        .toFile(output);
      console.log(`✅ ${app}: ${logoFile} → logo.png`);
    } catch (e) {
      console.error(`❌ ${app}: ${e.message}`);
    }
  }
  console.log('\nDone!');
}

convertAll();
