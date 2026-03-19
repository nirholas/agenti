#!/usr/bin/env node
/**
 * Capture demo in parts - one command at a time
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FRAMES_DIR = path.join(ASSETS_DIR, 'frames');

// Get command index from args (0-6)
const partNum = parseInt(process.argv[2] || '0');

const commands = [
  'find arbitrage over 2%',
  'search bitcoin 100k',
  'buy 50 YES BTC 100k at 0.42',
  'swap 100 USDC to SOL',
  'show whales polymarket',
  'portfolio',
  'copy wallet 0x7c22 10%',
];

if (partNum >= commands.length) {
  console.log('Combining all parts into GIF...');
  const gifPath = path.join(ASSETS_DIR, 'demo.gif');
  execSync(`ffmpeg -y -framerate 8 -pattern_type glob -i "${FRAMES_DIR}/*.png" -vf "fps=8,scale=700:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse" "${gifPath}"`, { stdio: 'inherit' });
  fs.copyFileSync(gifPath, path.join(__dirname, '..', 'apps', 'docs', 'public', 'demo.gif'));
  console.log('✅ Done:', gifPath);
  process.exit(0);
}

// Clear frames on first run
if (partNum === 0) {
  if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.readdirSync(FRAMES_DIR).forEach(f => fs.unlinkSync(path.join(FRAMES_DIR, f)));
}

async function capturePart() {
  const cmd = commands[partNum];
  console.log(`Part ${partNum}: "${cmd}"`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 500 });

  let frameNum = partNum * 100; // Each part gets 100 frame slots
  const capture = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      await page.screenshot({ path: path.join(FRAMES_DIR, `frame_${String(frameNum++).padStart(4, '0')}.png`) });
    }
  };

  try {
    await page.goto('http://localhost:18789/webchat', { waitUntil: 'load', timeout: 15000 });
    await capture(5);

    // Type command
    await page.type('#input', cmd, { delay: 40 });
    await capture(3);

    // Send
    await page.click('button');
    await capture(2);

    // Wait for response
    console.log('Waiting for response...');
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const hasResponse = await page.$('.msg.bot');
      if (hasResponse) {
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
    await capture(15);

    console.log(`✅ Part ${partNum} done (${frameNum - partNum * 100} frames)`);
  } finally {
    await browser.close();
  }
}

capturePart().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
