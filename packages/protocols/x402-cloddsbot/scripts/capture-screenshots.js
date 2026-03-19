#!/usr/bin/env node
/**
 * Screenshot capture script for README
 * Uses Puppeteer to capture realistic screenshots
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SCREENSHOTS_DIR = path.join(ASSETS_DIR, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// WebChat HTML with sample conversation
const webchatHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Clodds WebChat</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 700px;
      margin: 0 auto;
      padding: 20px;
      background: #1e1e1e;
      color: #fff;
      min-height: 100vh;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #fff;
    }
    #messages {
      height: 500px;
      overflow-y: auto;
      background: #252526;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .msg {
      margin: 10px 0;
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 85%;
      line-height: 1.5;
    }
    .user {
      background: #0078d4;
      color: #fff;
      margin-left: auto;
      text-align: left;
    }
    .bot {
      background: #2d2d30;
      color: #d4d4d4;
    }
    .bot pre {
      margin: 8px 0 0 0;
      padding: 10px;
      background: #1e1e1e;
      border-radius: 6px;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .bot .highlight { color: #4fc3f7; }
    .bot .success { color: #81c784; }
    .bot .warning { color: #ffd54f; }
    .bot .error { color: #ef5350; }
    .bot .muted { color: #888; }
    .system {
      background: transparent;
      color: #888;
      font-size: 13px;
      text-align: center;
    }
    #input-area {
      display: flex;
      gap: 10px;
    }
    #input {
      flex: 1;
      padding: 12px 16px;
      border-radius: 20px;
      border: none;
      background: #3c3c3c;
      color: #fff;
      font-size: 14px;
    }
    #input::placeholder { color: #888; }
    button {
      padding: 12px 24px;
      border-radius: 20px;
      border: none;
      background: #0078d4;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>🎲 Clodds WebChat</h1>
  <div id="messages">
    <div class="msg system">Connected to Clodds. Ready!</div>

    <div class="msg user">/opportunity scan election</div>
    <div class="msg bot">
      <strong>Opportunities Found: 3</strong>
      <pre><span class="highlight">🌐 3.2% edge</span> (score: 92)
   <span class="success">🟢 BUY YES @ 52.0c</span>
   <span class="muted">polymarket - Will Trump win the 2024 election?</span>
   <span class="error">🔴 SELL YES @ 55.2c</span>
   <span class="muted">kalshi - Trump wins presidential election</span>
   <span class="warning">💰 Profit/$100: $3.20 | Kelly: 8.1%</span>
   <span class="muted">⚠️ Slippage: ~0.3% | Liq: $45,200</span>

<span class="highlight">🔄 2.8% edge</span> (score: 85)
   <span class="success">🟢 BUY YES @ 34.0c + BUY NO @ 63.2c = 97.2c</span>
   <span class="muted">polymarket - Fed cuts rates in January</span>
   <span class="warning">💰 Profit/$100: $2.88 | Kelly: 7.0%</span></pre>
    </div>

    <div class="msg user">/portfolio</div>
    <div class="msg bot">
      <strong>Portfolio Summary</strong>
      <pre>Positions: 5
Total Value: <span class="highlight">$2,450</span>
Today P&L: <span class="success">+$127 (+5.2%)</span>

<span class="highlight">TRUMP-WIN</span>  YES  200 @ 0.48  <span class="success">+$24</span>
<span class="highlight">FED-RATE</span>   NO   150 @ 0.35  <span class="success">+$18</span>
<span class="highlight">BTC-100K</span>   YES  100 @ 0.62  <span class="success">+$31</span>
<span class="highlight">ETH-ATH</span>    NO    75 @ 0.28  <span class="error">-$8</span>
<span class="highlight">SUPERBOWL</span> YES   50 @ 0.55  <span class="success">+$12</span></pre>
    </div>

    <div class="msg user">/opportunity combinatorial</div>
    <div class="msg bot">
      <strong>Combinatorial Arbitrage Scan</strong>
      <span class="muted">(Based on arXiv:2508.03474)</span>
      <pre>Scanned: 847 markets, 2,341 pairs
Clusters found: 23

<span class="highlight">Rebalancing (YES+NO != $1): 2</span>
📈 2.1% - Fed rate decision Jan...
   Cost: $0.979 → Payout: $1.00 | Net: $0.021

<span class="highlight">Combinatorial (conditional deps): 1</span>
→ 3.0% (implies)
   Trump 55c > Republican 52c
   <span class="error">Violation: P(Trump) ≤ P(GOP)</span>
   Strategy: SELL Trump, BUY GOP</pre>
    </div>
  </div>
  <div id="input-area">
    <input type="text" id="input" placeholder="Type a command... (/help for list)" />
    <button>Send</button>
  </div>
</body>
</html>
`;

// Terminal-style arbitrage output
const arbitrageHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Arbitrage Scanner</title>
  <style>
    body {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
      margin: 0;
      line-height: 1.6;
    }
    .terminal {
      background: #161b22;
      border-radius: 8px;
      padding: 20px;
      max-width: 750px;
    }
    .title-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 15px;
    }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .red { background: #ff5f57; }
    .yellow { background: #febc2e; }
    .green { background: #28c840; }
    .cmd { color: #58a6ff; }
    .output { margin-top: 10px; }
    .header { color: #f0f6fc; font-weight: bold; font-size: 15px; margin: 15px 0 10px 0; }
    .opp { margin: 15px 0; padding-left: 15px; border-left: 2px solid #30363d; }
    .edge { color: #58a6ff; font-weight: bold; }
    .buy { color: #3fb950; }
    .sell { color: #f85149; }
    .muted { color: #8b949e; }
    .profit { color: #d29922; }
    .score { color: #a371f7; }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="title-bar">
      <div class="dot red"></div>
      <div class="dot yellow"></div>
      <div class="dot green"></div>
    </div>
    <div class="cmd">$ clodds opportunity scan election --minEdge=1</div>
    <div class="output">
      <div class="header">🔍 Scanning 9 platforms for arbitrage...</div>
      <div class="muted">Polymarket ✓ | Kalshi ✓ | Betfair ✓ | Manifold ✓ | PredictIt ✓</div>

      <div class="header">Opportunities Found: 5</div>

      <div class="opp">
        <div><span class="edge">🌐 3.2% edge</span> <span class="score">(score: 92)</span></div>
        <div><span class="buy">   🟢 BUY YES @ 52.0c</span></div>
        <div><span class="muted">   polymarket - Will Trump win the 2024 election?</span></div>
        <div><span class="sell">   🔴 SELL YES @ 55.2c</span></div>
        <div><span class="muted">   kalshi - Trump wins presidential election</span></div>
        <div><span class="profit">   💰 Profit/$100: $3.20 | Kelly: 8.1%</span></div>
        <div><span class="muted">   ⚠️ Slippage: ~0.3% | Liq: $45,200</span></div>
      </div>

      <div class="opp">
        <div><span class="edge">🔄 2.8% edge</span> <span class="score">(score: 85)</span></div>
        <div><span class="buy">   🟢 BUY YES @ 34.0c + BUY NO @ 63.2c = 97.2c</span></div>
        <div><span class="muted">   polymarket - Fed cuts rates in January</span></div>
        <div><span class="profit">   💰 Profit/$100: $2.88 | Kelly: 7.0%</span></div>
        <div><span class="muted">   ⚠️ Slippage: ~0.5% | Liq: $12,800</span></div>
      </div>

      <div class="opp">
        <div><span class="edge">🔗 2.5% edge</span> <span class="score">(score: 78)</span> <span class="muted">(combinatorial)</span></div>
        <div><span class="muted">   Relationship: implies (Trump → GOP)</span></div>
        <div><span class="sell">   🔴 SELL Trump YES @ 55c</span></div>
        <div><span class="buy">   🟢 BUY Republican YES @ 52c</span></div>
        <div><span class="profit">   💰 Profit: 3c guaranteed | Confidence: 95%</span></div>
      </div>

      <div class="opp">
        <div><span class="edge">📊 1.8% edge</span> <span class="score">(score: 71)</span></div>
        <div><span class="buy">   🟢 BUY YES @ 48.0c</span> <span class="muted">(fair value: 49.8c)</span></div>
        <div><span class="muted">   betfair - Next UK Prime Minister</span></div>
        <div><span class="profit">   💰 Profit/$100: $1.80 | Kelly: 4.5%</span></div>
      </div>

      <div class="opp">
        <div><span class="edge">🌐 1.2% edge</span> <span class="score">(score: 65)</span></div>
        <div><span class="buy">   🟢 BUY YES @ 67.0c</span></div>
        <div><span class="muted">   polymarket - BTC above $100k by Feb</span></div>
        <div><span class="sell">   🔴 SELL YES @ 68.2c</span></div>
        <div><span class="muted">   kalshi - Bitcoin $100,000 before March</span></div>
        <div><span class="profit">   💰 Profit/$100: $1.20 | Kelly: 3.0%</span></div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Portfolio dashboard
const portfolioHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Portfolio Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 30px;
      margin: 0;
    }
    .dashboard {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { color: #f0f6fc; font-size: 28px; margin-bottom: 5px; }
    .subtitle { color: #8b949e; margin-bottom: 30px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .card {
      background: #161b22;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #30363d;
    }
    .card-label { color: #8b949e; font-size: 12px; text-transform: uppercase; }
    .card-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
    .positive { color: #3fb950; }
    .negative { color: #f85149; }
    .neutral { color: #58a6ff; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #161b22;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      text-align: left;
      padding: 12px 15px;
      background: #21262d;
      color: #8b949e;
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
    }
    td {
      padding: 12px 15px;
      border-top: 1px solid #30363d;
    }
    .market { color: #58a6ff; }
    .platform { color: #8b949e; font-size: 12px; }
  </style>
</head>
<body>
  <div class="dashboard">
    <h1>📊 Portfolio Dashboard</h1>
    <div class="subtitle">Real-time positions across all platforms</div>

    <div class="cards">
      <div class="card">
        <div class="card-label">Total Value</div>
        <div class="card-value neutral">$2,450</div>
      </div>
      <div class="card">
        <div class="card-label">Today's P&L</div>
        <div class="card-value positive">+$127</div>
      </div>
      <div class="card">
        <div class="card-label">Win Rate</div>
        <div class="card-value positive">68%</div>
      </div>
      <div class="card">
        <div class="card-label">Active Positions</div>
        <div class="card-value neutral">5</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Market</th>
          <th>Side</th>
          <th>Size</th>
          <th>Entry</th>
          <th>Current</th>
          <th>P&L</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="market">Trump wins 2024</div>
            <div class="platform">polymarket</div>
          </td>
          <td>YES</td>
          <td>200</td>
          <td>48.0c</td>
          <td>52.0c</td>
          <td class="positive">+$24.00</td>
        </tr>
        <tr>
          <td>
            <div class="market">Fed rate cut January</div>
            <div class="platform">kalshi</div>
          </td>
          <td>NO</td>
          <td>150</td>
          <td>35.0c</td>
          <td>32.0c</td>
          <td class="positive">+$18.00</td>
        </tr>
        <tr>
          <td>
            <div class="market">BTC > $100k by Feb</div>
            <div class="platform">polymarket</div>
          </td>
          <td>YES</td>
          <td>100</td>
          <td>62.0c</td>
          <td>67.0c</td>
          <td class="positive">+$31.00</td>
        </tr>
        <tr>
          <td>
            <div class="market">ETH all-time high Q1</div>
            <div class="platform">manifold</div>
          </td>
          <td>NO</td>
          <td>75</td>
          <td>28.0c</td>
          <td>31.0c</td>
          <td class="negative">-$8.00</td>
        </tr>
        <tr>
          <td>
            <div class="market">Super Bowl winner</div>
            <div class="platform">betfair</div>
          </td>
          <td>YES</td>
          <td>50</td>
          <td>55.0c</td>
          <td>58.0c</td>
          <td class="positive">+$12.00</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
`;

// Telegram-style chat
const telegramHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Telegram Chat</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #17212b;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .phone {
      width: 375px;
      background: #0e1621;
      border-radius: 30px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .header {
      background: #17212b;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
    }
    .header-text h2 { margin: 0; color: #fff; font-size: 16px; }
    .header-text p { margin: 2px 0 0 0; color: #6c7883; font-size: 13px; }
    .chat {
      padding: 15px;
      height: 480px;
      overflow-y: auto;
    }
    .message {
      max-width: 85%;
      margin: 8px 0;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }
    .user {
      background: #2b5278;
      color: #fff;
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }
    .bot {
      background: #182533;
      color: #f5f5f5;
      border-bottom-left-radius: 4px;
    }
    .bot pre {
      margin: 8px 0 0 0;
      font-family: 'SF Mono', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      color: #e0e0e0;
    }
    .bot .hl { color: #64b5f6; }
    .bot .ok { color: #81c784; }
    .bot .warn { color: #ffb74d; }
    .bot .err { color: #e57373; }
    .bot .dim { color: #90a4ae; }
    .input-area {
      background: #17212b;
      padding: 10px 15px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .input-area input {
      flex: 1;
      background: #242f3d;
      border: none;
      border-radius: 20px;
      padding: 10px 15px;
      color: #fff;
      font-size: 14px;
    }
    .send-btn {
      width: 36px;
      height: 36px;
      background: #64b5f6;
      border-radius: 50%;
      border: none;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="phone">
    <div class="header">
      <div class="avatar">🎲</div>
      <div class="header-text">
        <h2>Clodds Bot</h2>
        <p>online</p>
      </div>
    </div>
    <div class="chat">
      <div class="message user">/opportunity scan</div>
      <div class="message bot">
        <strong>Opportunities Found: 3</strong>
        <pre><span class="hl">🌐 3.2% edge</span> (score: 92)
   <span class="ok">🟢 BUY YES @ 52c</span>
   <span class="dim">polymarket - Trump wins 2024</span>
   <span class="err">🔴 SELL YES @ 55c</span>
   <span class="dim">kalshi - Trump presidency</span>
   <span class="warn">💰 $3.20/100 | Kelly: 8%</span></pre>
      </div>
      <div class="message user">/portfolio</div>
      <div class="message bot">
        <strong>Portfolio Summary</strong>
        <pre>Positions: 5
Total: <span class="hl">$2,450</span>
P&L: <span class="ok">+$127 (+5.2%)</span>

<span class="hl">TRUMP-WIN</span> YES 200 <span class="ok">+$24</span>
<span class="hl">FED-RATE</span>  NO  150 <span class="ok">+$18</span>
<span class="hl">BTC-100K</span>  YES 100 <span class="ok">+$31</span></pre>
      </div>
      <div class="message user">/trades stats</div>
      <div class="message bot">
        <strong>Trade Stats (30d)</strong>
        <pre>Trades: 47
Win Rate: <span class="ok">68.1%</span>
Total P&L: <span class="ok">+$1,247</span>
Avg/Trade: <span class="ok">+$26.54</span>

Best pair: poly↔kalshi (72%)</pre>
      </div>
    </div>
    <div class="input-area">
      <input placeholder="Message..." />
      <button class="send-btn">➤</button>
    </div>
  </div>
</body>
</html>
`;

async function captureScreenshots() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Capture WebChat
    console.log('Capturing webchat.png...');
    const webchatPage = await browser.newPage();
    await webchatPage.setViewport({ width: 800, height: 650 });
    await webchatPage.setContent(webchatHTML);
    await webchatPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'webchat.png'),
      type: 'png'
    });
    await webchatPage.close();

    // Capture Arbitrage
    console.log('Capturing arbitrage.png...');
    const arbPage = await browser.newPage();
    await arbPage.setViewport({ width: 850, height: 700 });
    await arbPage.setContent(arbitrageHTML);
    await arbPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'arbitrage.png'),
      type: 'png'
    });
    await arbPage.close();

    // Capture Portfolio
    console.log('Capturing portfolio.png...');
    const portfolioPage = await browser.newPage();
    await portfolioPage.setViewport({ width: 900, height: 550 });
    await portfolioPage.setContent(portfolioHTML);
    await portfolioPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'portfolio.png'),
      type: 'png'
    });
    await portfolioPage.close();

    // Capture Telegram
    console.log('Capturing telegram.png...');
    const telegramPage = await browser.newPage();
    await telegramPage.setViewport({ width: 450, height: 680 });
    await telegramPage.setContent(telegramHTML);
    await telegramPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'telegram.png'),
      type: 'png'
    });
    await telegramPage.close();

    console.log('✅ All screenshots captured successfully!');
    console.log('Screenshots saved to:', SCREENSHOTS_DIR);

    // List files
    const files = fs.readdirSync(SCREENSHOTS_DIR);
    console.log('Files:', files.join(', '));

  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
