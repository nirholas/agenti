#!/usr/bin/env node
/**
 * Capture REAL Clodds WebChat Demo
 * Records actual interaction with the live webchat
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FRAMES_DIR = path.join(ASSETS_DIR, 'frames');
const WEBCHAT_URL = 'http://localhost:18789/webchat?token=skip';

// Ensure directories
if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.readdirSync(FRAMES_DIR).forEach(f => fs.unlinkSync(path.join(FRAMES_DIR, f)));

const commands = [
  'find arbitrage',
  'search trump polymarket',
  'show whales',
  'portfolio',
];

async function captureDemo() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    protocolTimeout: 180000,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  await page.setViewport({ width: 700, height: 500 });

  let frameNum = 0;
  const captureFrame = async (count = 1) => {
    for (let i = 0; i < count; i++) {
      await page.screenshot({
        path: path.join(FRAMES_DIR, `frame_${String(frameNum++).padStart(4, '0')}.png`)
      });
    }
  };

  try {
    console.log('Loading webchat...');
    await page.goto(WEBCHAT_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await captureFrame(15); // Initial state

    for (const cmd of commands) {
      console.log(`Typing: ${cmd}`);

      // Type the command
      await page.type('#input', cmd, { delay: 50 });
      await captureFrame(5);

      // Send it
      await page.click('button');
      await captureFrame(5);

      // Wait for response (Claude takes time)
      console.log('Waiting for Claude response...');
      const startMsgCount = await page.$$eval('.msg', els => els.length);

      // Wait up to 90s for response to appear and complete
      let lastText = '';
      let stableCount = 0;
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const currentCount = await page.$$eval('.msg', els => els.length);
        if (currentCount > startMsgCount) {
          // Get the last bot message text
          const currentText = await page.$$eval('.msg.bot', els => {
            const last = els[els.length - 1];
            return last ? last.textContent : '';
          });

          // Check if response is still streaming (text changing)
          if (currentText === lastText && currentText.length > 10) {
            stableCount++;
            if (stableCount >= 3) {
              console.log('Response complete:', currentText.slice(0, 50) + '...');
              break;
            }
          } else {
            stableCount = 0;
            lastText = currentText;
          }
        }
      }

      // Extra wait to ensure rendering is done
      await new Promise(r => setTimeout(r, 1000));
      await captureFrame(40); // Capture response with more frames
    }

    await captureFrame(20); // Final pause

    console.log(`Captured ${frameNum} frames`);

    // Generate GIF
    console.log('Generating GIF...');
    const gifPath = path.join(ASSETS_DIR, 'demo.gif');
    execSync(`ffmpeg -y -framerate 10 -i "${FRAMES_DIR}/frame_%04d.png" -vf "fps=10,scale=700:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gifPath}"`, { stdio: 'inherit' });

    // Copy to docs
    const docsGif = path.join(__dirname, '..', 'apps', 'docs', 'public', 'demo.gif');
    fs.copyFileSync(gifPath, docsGif);
    console.log('✅ Demo GIF saved to:', gifPath);

  } finally {
    await browser.close();
  }
}

captureDemo().catch(console.error);
