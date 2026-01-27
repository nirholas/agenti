/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Web Templates for Sandbox IDE
 */

export interface WebTemplate {
  id: string;
  name: string;
  description: string;
  category: 'starter' | 'web3' | 'ui' | 'api' | 'game' | 'utility';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  files: { name: string; language: string; content: string; isEntry?: boolean }[];
  examplePrompts: string[];
}

export const webTemplates: WebTemplate[] = [
  // === STARTER TEMPLATES ===
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Empty HTML/CSS/JS starter',
    category: 'starter',
    difficulty: 'beginner',
    examplePrompts: ['Start fresh', 'Empty project', 'Blank canvas'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }` },
      { name: 'app.js', language: 'javascript', content: `console.log('Hello World!');` }
    ]
  },
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Simple interactive starter with counter',
    category: 'starter',
    difficulty: 'beginner',
    examplePrompts: ['Hello world', 'Counter app', 'Basic interactive'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hello World</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <h1>Hello, World! 🚀</h1>
    <p>Start editing to see changes live.</p>
    <button id="counter-btn">Clicked: 0 times</button>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
#app {
  text-align: center;
  padding: 48px;
  background: rgba(255,255,255,0.1);
  border-radius: 24px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}
h1 { font-size: 3rem; margin-bottom: 16px; }
p { font-size: 1.25rem; opacity: 0.9; margin-bottom: 24px; }
button {
  background: #fff;
  color: #667eea;
  border: none;
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}
button:hover { transform: translateY(-2px); }` },
      { name: 'app.js', language: 'javascript', content: `let count = 0;
const button = document.getElementById('counter-btn');
button.addEventListener('click', () => {
  count++;
  button.textContent = \`Clicked: \${count} times\`;
  console.log('Count:', count);
});
console.log('🚀 App initialized!');` }
    ]
  },

  // === WEB3 TEMPLATES ===
  {
    id: 'wallet-connect',
    name: 'Wallet Connect',
    description: 'Connect to MetaMask and display balance',
    category: 'web3',
    difficulty: 'beginner',
    examplePrompts: ['Connect wallet', 'MetaMask integration', 'Web3 wallet'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wallet Connect</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>🦊 Wallet Connect</h1>
    <div id="wallet-info" class="hidden">
      <p>Address: <span id="address"></span></p>
      <p>Balance: <span id="balance"></span> ETH</p>
      <p>Network: <span id="network"></span></p>
    </div>
    <button id="connect-btn">Connect Wallet</button>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `.container {
  max-width: 500px;
  margin: 100px auto;
  padding: 40px;
  text-align: center;
  background: #1a1a2e;
  border-radius: 16px;
  color: #fff;
  font-family: system-ui, sans-serif;
}
h1 { margin-bottom: 24px; }
#wallet-info { margin: 24px 0; text-align: left; padding: 16px; background: #16213e; border-radius: 8px; }
#wallet-info p { margin: 8px 0; font-size: 14px; word-break: break-all; }
.hidden { display: none; }
button {
  background: linear-gradient(135deg, #f5af19, #f12711);
  color: #fff;
  border: none;
  padding: 16px 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
}
button:hover { opacity: 0.9; }
button:disabled { opacity: 0.5; cursor: not-allowed; }` },
      { name: 'app.js', language: 'javascript', content: `const connectBtn = document.getElementById('connect-btn');
const walletInfo = document.getElementById('wallet-info');
const addressEl = document.getElementById('address');
const balanceEl = document.getElementById('balance');
const networkEl = document.getElementById('network');

const networks = { '0x1': 'Ethereum', '0x89': 'Polygon', '0xa86a': 'Avalanche', '0x38': 'BSC' };

async function connectWallet() {
  if (!window.ethereum) {
    alert('Please install MetaMask!');
    return;
  }
  
  connectBtn.textContent = 'Connecting...';
  connectBtn.disabled = true;
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const account = accounts[0];
    
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [account, 'latest']
    });
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    addressEl.textContent = account.slice(0, 6) + '...' + account.slice(-4);
    balanceEl.textContent = (parseInt(balance, 16) / 1e18).toFixed(4);
    networkEl.textContent = networks[chainId] || chainId;
    
    walletInfo.classList.remove('hidden');
    connectBtn.textContent = 'Connected ✓';
    
    console.log('Connected:', account);
  } catch (err) {
    console.error(err);
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.disabled = false;
  }
}

connectBtn.addEventListener('click', connectWallet);

window.ethereum?.on('accountsChanged', () => location.reload());
window.ethereum?.on('chainChanged', () => location.reload());` }
    ]
  },
  {
    id: 'defi-dashboard',
    name: 'DeFi Dashboard',
    description: 'Live DeFi analytics with DeFiLlama API',
    category: 'web3',
    difficulty: 'intermediate',
    examplePrompts: ['DeFi dashboard', 'TVL tracker', 'Protocol analytics', 'Yield farming', 'DeFiLlama'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeFi Dashboard - Live Analytics</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">📊</span>
        <span class="logo-text">DeFi Dashboard</span>
      </div>
      <div class="header-stats">
        <div class="stat">
          <span class="stat-label">Total TVL</span>
          <span class="stat-value" id="total-tvl">Loading...</span>
        </div>
      </div>
    </header>
    <main class="dashboard">
      <section class="card">
        <div class="card-header">
          <h2>🏦 Top DeFi Protocols</h2>
          <span class="badge">Live</span>
        </div>
        <div class="card-content" id="protocols-list">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h2>📈 Top Yields</h2>
          <span class="badge badge-green">APY</span>
        </div>
        <div class="card-content" id="yields-list">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h2>⛓️ Top Chains</h2>
          <span class="badge badge-purple">TVL</span>
        </div>
        <div class="card-content" id="chains-list">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      </section>
    </main>
    <footer class="footer">
      <p>Data from <a href="https://defillama.com" target="_blank">DeFiLlama API</a></p>
    </footer>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `:root {
  --bg-primary: #0f0f1a;
  --bg-card: #16213e;
  --text-primary: #fff;
  --text-secondary: #a0a0b0;
  --accent: #6366f1;
  --green: #10b981;
  --red: #ef4444;
  --border: #2a2a4a;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
#app { max-width: 1200px; margin: 0 auto; padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: #1a1a2e; border-radius: 16px; margin-bottom: 24px; border: 1px solid var(--border); }
.logo { display: flex; align-items: center; gap: 12px; }
.logo-icon { font-size: 28px; }
.logo-text { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.stat-label { display: block; font-size: 0.75rem; color: var(--text-secondary); }
.stat-value { font-size: 1.25rem; font-weight: 700; color: var(--green); }
.dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 24px; }
.card { background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
.card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.card-header h2 { font-size: 1rem; }
.badge { font-size: 0.7rem; padding: 4px 10px; border-radius: 20px; background: var(--accent); color: white; animation: pulse 2s infinite; }
.badge-green { background: var(--green); }
.badge-purple { background: #8b5cf6; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.card-content { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.item { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px; transition: all 0.2s; }
.item:hover { background: rgba(255,255,255,0.06); transform: translateX(4px); }
.item-rank { width: 24px; text-align: center; font-size: 0.75rem; color: var(--text-secondary); }
.item-logo { width: 32px; height: 32px; border-radius: 50%; background: #1a1a2e; }
.item-info { flex: 1; min-width: 0; }
.item-name { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-category { font-size: 0.75rem; color: var(--text-secondary); }
.item-tvl { font-weight: 600; }
.item-change { font-size: 0.75rem; }
.item-change.positive { color: var(--green); }
.item-change.negative { color: var(--red); }
.item-apy { font-size: 1.1rem; font-weight: 700; color: var(--green); }
.skeleton { height: 56px; background: linear-gradient(90deg, #1a1a2e 25%, rgba(255,255,255,0.05) 50%, #1a1a2e 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 10px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.footer { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 0.875rem; }
.footer a { color: var(--accent); }
.error { text-align: center; padding: 24px; color: var(--red); }` },
      { name: 'app.js', language: 'javascript', content: `// DeFi Dashboard - DeFiLlama API
const API = {
  protocols: 'https://api.llama.fi/protocols',
  yields: 'https://yields.llama.fi/pools',
  chains: 'https://api.llama.fi/v2/chains'
};

function formatTVL(tvl) {
  if (!tvl) return 'N/A';
  if (tvl >= 1e9) return '$' + (tvl / 1e9).toFixed(2) + 'B';
  if (tvl >= 1e6) return '$' + (tvl / 1e6).toFixed(2) + 'M';
  return '$' + (tvl / 1e3).toFixed(2) + 'K';
}

function renderProtocol(p, rank) {
  const change = (p.change_1d || 0) >= 0 ? 'positive' : 'negative';
  const changeText = (p.change_1d || 0) >= 0 ? '+' : '';
  return \`<div class="item">
    <span class="item-rank">\${rank}</span>
    <img class="item-logo" src="\${p.logo || ''}" onerror="this.style.display='none'">
    <div class="item-info"><div class="item-name">\${p.name}</div><div class="item-category">\${p.category || 'DeFi'}</div></div>
    <div><div class="item-tvl">\${formatTVL(p.tvl)}</div><div class="item-change \${change}">\${changeText}\${(p.change_1d || 0).toFixed(2)}%</div></div>
  </div>\`;
}

function renderYield(p) {
  return \`<div class="item">
    <div class="item-info"><div class="item-name">\${p.symbol}</div><div class="item-category">\${p.project} • \${p.chain}</div></div>
    <div><div class="item-apy">\${p.apy?.toFixed(2) || 0}%</div><div class="item-category">TVL: \${formatTVL(p.tvlUsd)}</div></div>
  </div>\`;
}

function renderChain(c, rank) {
  return \`<div class="item">
    <span class="item-rank">\${rank}</span>
    <div class="item-info"><div class="item-name">\${c.name}</div><div class="item-category">\${c.tokenSymbol || 'Native'}</div></div>
    <div class="item-tvl">\${formatTVL(c.tvl)}</div>
  </div>\`;
}

async function fetchProtocols() {
  try {
    const res = await fetch(API.protocols);
    const data = await res.json();
    const top = data.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)).slice(0, 5);
    const total = data.reduce((sum, p) => sum + (p.tvl || 0), 0);
    document.getElementById('total-tvl').textContent = formatTVL(total);
    document.getElementById('protocols-list').innerHTML = top.map((p, i) => renderProtocol(p, i + 1)).join('');
  } catch (e) {
    document.getElementById('protocols-list').innerHTML = '<div class="error">Failed to load</div>';
  }
}

async function fetchYields() {
  try {
    const res = await fetch(API.yields);
    const data = await res.json();
    const top = data.data.filter(p => p.apy > 0 && p.tvlUsd > 1000000).sort((a, b) => b.apy - a.apy).slice(0, 5);
    document.getElementById('yields-list').innerHTML = top.map(p => renderYield(p)).join('');
  } catch (e) {
    document.getElementById('yields-list').innerHTML = '<div class="error">Failed to load</div>';
  }
}

async function fetchChains() {
  try {
    const res = await fetch(API.chains);
    const data = await res.json();
    const top = data.sort((a, b) => (b.tvl || 0) - (a.tvl || 0)).slice(0, 5);
    document.getElementById('chains-list').innerHTML = top.map((c, i) => renderChain(c, i + 1)).join('');
  } catch (e) {
    document.getElementById('chains-list').innerHTML = '<div class="error">Failed to load</div>';
  }
}

console.log('🚀 DeFi Dashboard loading...');
Promise.all([fetchProtocols(), fetchYields(), fetchChains()]).then(() => console.log('✅ Dashboard loaded!'));
setInterval(() => { fetchProtocols(); fetchYields(); fetchChains(); }, 60000);` }
    ]
  },
  {
    id: 'token-swap',
    name: 'Token Swap Interface',
    description: 'DEX-style token swap UI with price quotes',
    category: 'web3',
    difficulty: 'intermediate',
    examplePrompts: ['Token swap', 'DEX interface', 'Swap tokens', 'Uniswap clone'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Token Swap</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="swap-container">
    <div class="swap-card">
      <div class="swap-header">
        <h1>🔄 Swap</h1>
        <button class="settings-btn" id="settings-btn">⚙️</button>
      </div>
      
      <!-- From Token -->
      <div class="token-input">
        <div class="token-input-header">
          <span>From</span>
          <span class="balance">Balance: <span id="from-balance">0.00</span></span>
        </div>
        <div class="token-input-row">
          <input type="number" id="from-amount" placeholder="0.0" step="any">
          <button class="token-select" id="from-token">
            <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH">
            <span>ETH</span>
            <span class="chevron">▼</span>
          </button>
        </div>
        <div class="usd-value" id="from-usd">~$0.00</div>
      </div>
      
      <!-- Swap Arrow -->
      <button class="swap-arrow" id="swap-direction">↓</button>
      
      <!-- To Token -->
      <div class="token-input">
        <div class="token-input-header">
          <span>To</span>
          <span class="balance">Balance: <span id="to-balance">0.00</span></span>
        </div>
        <div class="token-input-row">
          <input type="number" id="to-amount" placeholder="0.0" readonly>
          <button class="token-select" id="to-token">
            <img src="https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" alt="USDC">
            <span>USDC</span>
            <span class="chevron">▼</span>
          </button>
        </div>
        <div class="usd-value" id="to-usd">~$0.00</div>
      </div>
      
      <!-- Price Info -->
      <div class="price-info" id="price-info">
        <span>1 ETH = <span id="exchange-rate">--</span> USDC</span>
        <span class="gas">⛽ ~$<span id="gas-estimate">0.00</span></span>
      </div>
      
      <!-- Swap Button -->
      <button class="swap-btn" id="swap-btn">Connect Wallet</button>
      
      <!-- Slippage Modal -->
      <div class="modal hidden" id="settings-modal">
        <div class="modal-content">
          <h3>Transaction Settings</h3>
          <label>Slippage Tolerance</label>
          <div class="slippage-options">
            <button class="slippage-btn active">0.5%</button>
            <button class="slippage-btn">1%</button>
            <button class="slippage-btn">2%</button>
            <input type="number" placeholder="Custom" class="slippage-input">
          </div>
          <button class="close-modal" id="close-modal">Done</button>
        </div>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `:root {
  --bg: #0d0d1a;
  --card: #1a1a2e;
  --input-bg: #0f0f1a;
  --border: #2a2a4a;
  --text: #fff;
  --text-secondary: #888;
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --green: #10b981;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}
.swap-container { padding: 20px; width: 100%; max-width: 480px; }
.swap-card {
  background: var(--card);
  border-radius: 24px;
  padding: 16px;
  border: 1px solid var(--border);
}
.swap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 8px;
}
.swap-header h1 { font-size: 1.25rem; }
.settings-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.settings-btn:hover { opacity: 1; }
.token-input {
  background: var(--input-bg);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid var(--border);
}
.token-input-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.token-input-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.token-input input {
  flex: 1;
  background: none;
  border: none;
  font-size: 2rem;
  font-weight: 500;
  color: var(--text);
  outline: none;
  min-width: 0;
}
.token-input input::placeholder { color: #444; }
.token-select {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 8px 12px;
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.token-select:hover { background: #252540; }
.token-select img { width: 24px; height: 24px; border-radius: 50%; }
.chevron { font-size: 0.75rem; opacity: 0.5; }
.usd-value {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 8px;
}
.swap-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: -8px auto;
  background: var(--card);
  border: 4px solid var(--bg);
  border-radius: 12px;
  font-size: 1.25rem;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: transform 0.2s;
}
.swap-arrow:hover { transform: rotate(180deg); }
.price-info {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  margin-top: 12px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}
.gas { color: var(--green); }
.swap-btn {
  width: 100%;
  padding: 18px;
  margin-top: 12px;
  background: var(--accent);
  border: none;
  border-radius: 16px;
  color: var(--text);
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.swap-btn:hover { background: var(--accent-hover); }
.swap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
.modal.hidden { display: none; }
.modal-content {
  background: var(--card);
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}
.modal-content h3 { margin-bottom: 16px; }
.modal-content label { display: block; color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 8px; }
.slippage-options { display: flex; gap: 8px; margin-bottom: 16px; }
.slippage-btn {
  padding: 10px 16px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  cursor: pointer;
}
.slippage-btn.active { background: var(--accent); border-color: var(--accent); }
.slippage-input {
  flex: 1;
  padding: 10px;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  width: 80px;
}
.close-modal {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  border: none;
  border-radius: 12px;
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}` },
      { name: 'app.js', language: 'javascript', content: `/**
 * Token Swap Interface
 * Fetches live prices from CoinGecko API
 */

// State
let state = {
  connected: false,
  account: null,
  fromToken: { symbol: 'ETH', id: 'ethereum', price: 0 },
  toToken: { symbol: 'USDC', id: 'usd-coin', price: 1 },
  slippage: 0.5
};

// DOM Elements
const fromAmount = document.getElementById('from-amount');
const toAmount = document.getElementById('to-amount');
const fromUsd = document.getElementById('from-usd');
const toUsd = document.getElementById('to-usd');
const exchangeRate = document.getElementById('exchange-rate');
const swapBtn = document.getElementById('swap-btn');
const swapDirection = document.getElementById('swap-direction');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModal = document.getElementById('close-modal');

// Fetch token prices from CoinGecko
async function fetchPrices() {
  try {
    const ids = [state.fromToken.id, state.toToken.id].join(',');
    const res = await fetch(
      \`https://api.coingecko.com/api/v3/simple/price?ids=\${ids}&vs_currencies=usd\`
    );
    const data = await res.json();
    
    state.fromToken.price = data[state.fromToken.id]?.usd || 0;
    state.toToken.price = data[state.toToken.id]?.usd || 1;
    
    updateExchangeRate();
    calculateSwap();
    
    console.log('💰 Prices updated:', {
      [state.fromToken.symbol]: state.fromToken.price,
      [state.toToken.symbol]: state.toToken.price
    });
  } catch (err) {
    console.error('Failed to fetch prices:', err);
  }
}

// Calculate swap output
function calculateSwap() {
  const amount = parseFloat(fromAmount.value) || 0;
  
  if (amount > 0 && state.fromToken.price > 0 && state.toToken.price > 0) {
    const usdValue = amount * state.fromToken.price;
    const outputAmount = usdValue / state.toToken.price;
    
    toAmount.value = outputAmount.toFixed(6);
    fromUsd.textContent = \`~$\${usdValue.toFixed(2)}\`;
    toUsd.textContent = \`~$\${(outputAmount * state.toToken.price).toFixed(2)}\`;
    
    if (state.connected) {
      swapBtn.textContent = 'Swap';
      swapBtn.disabled = false;
    }
  } else {
    toAmount.value = '';
    fromUsd.textContent = '~$0.00';
    toUsd.textContent = '~$0.00';
    
    if (state.connected) {
      swapBtn.textContent = 'Enter an amount';
      swapBtn.disabled = true;
    }
  }
}

// Update exchange rate display
function updateExchangeRate() {
  if (state.fromToken.price > 0 && state.toToken.price > 0) {
    const rate = state.fromToken.price / state.toToken.price;
    exchangeRate.textContent = rate.toFixed(2);
  }
}

// Connect wallet
async function connectWallet() {
  if (!window.ethereum) {
    alert('Please install MetaMask!');
    return;
  }
  
  try {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    state.connected = true;
    state.account = accounts[0];
    
    swapBtn.textContent = 'Enter an amount';
    swapBtn.disabled = true;
    
    console.log('🔗 Wallet connected:', state.account);
  } catch (err) {
    console.error('Failed to connect:', err);
  }
}

// Swap direction
function swapTokens() {
  const temp = state.fromToken;
  state.fromToken = state.toToken;
  state.toToken = temp;
  
  // Update UI
  document.querySelector('#from-token span:nth-child(2)').textContent = state.fromToken.symbol;
  document.querySelector('#to-token span:nth-child(2)').textContent = state.toToken.symbol;
  
  // Recalculate
  fromAmount.value = toAmount.value;
  calculateSwap();
  updateExchangeRate();
}

// Execute swap (simulated)
async function executeSwap() {
  if (!state.connected) {
    connectWallet();
    return;
  }
  
  const amount = parseFloat(fromAmount.value);
  if (!amount) return;
  
  swapBtn.textContent = 'Swapping...';
  swapBtn.disabled = true;
  
  // Simulate transaction
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('✅ Swap executed:', {
    from: \`\${amount} \${state.fromToken.symbol}\`,
    to: \`\${toAmount.value} \${state.toToken.symbol}\`
  });
  
  swapBtn.textContent = 'Swap Complete! ✓';
  setTimeout(() => {
    swapBtn.textContent = 'Swap';
    swapBtn.disabled = false;
  }, 2000);
}

// Event Listeners
fromAmount.addEventListener('input', calculateSwap);
swapBtn.addEventListener('click', executeSwap);
swapDirection.addEventListener('click', swapTokens);
settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeModal.addEventListener('click', () => settingsModal.classList.add('hidden'));

// Slippage buttons
document.querySelectorAll('.slippage-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.slippage-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.slippage = parseFloat(e.target.textContent);
    console.log('⚙️ Slippage set to:', state.slippage + '%');
  });
});

// Initialize
console.log('🔄 Token Swap UI initialized');
fetchPrices();
setInterval(fetchPrices, 30000); // Refresh prices every 30s` }
    ]
  },
  {
    id: 'portfolio-tracker',
    name: 'Crypto Portfolio Tracker',
    description: 'Track wallet holdings and portfolio value',
    category: 'web3',
    difficulty: 'intermediate',
    examplePrompts: ['Portfolio tracker', 'Wallet tracker', 'Holdings', 'Portfolio value'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Tracker</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header class="header">
      <h1>💼 Portfolio Tracker</h1>
      <button id="connect-btn" class="connect-btn">Connect Wallet</button>
    </header>
    
    <!-- Portfolio Summary -->
    <div class="summary-cards">
      <div class="summary-card">
        <span class="summary-label">Total Value</span>
        <span class="summary-value" id="total-value">$0.00</span>
        <span class="summary-change positive" id="total-change">+0.00%</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">24h Change</span>
        <span class="summary-value" id="day-change">$0.00</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">Assets</span>
        <span class="summary-value" id="asset-count">0</span>
      </div>
    </div>
    
    <!-- Holdings List -->
    <div class="holdings-section">
      <div class="section-header">
        <h2>Holdings</h2>
        <button class="add-btn" id="add-btn">+ Add Asset</button>
      </div>
      <div class="holdings-list" id="holdings-list">
        <div class="empty-state">
          <span>📊</span>
          <p>Connect wallet or add assets manually</p>
        </div>
      </div>
    </div>
    
    <!-- Add Asset Modal -->
    <div class="modal hidden" id="add-modal">
      <div class="modal-content">
        <h3>Add Asset</h3>
        <input type="text" id="asset-symbol" placeholder="Token Symbol (e.g., ETH)">
        <input type="number" id="asset-amount" placeholder="Amount" step="any">
        <div class="modal-actions">
          <button class="cancel-btn" id="cancel-add">Cancel</button>
          <button class="confirm-btn" id="confirm-add">Add</button>
        </div>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `:root {
  --bg: #0a0a0f;
  --card: #12121a;
  --border: #1f1f2e;
  --text: #fff;
  --text-secondary: #6b7280;
  --accent: #6366f1;
  --green: #10b981;
  --red: #ef4444;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
#app { max-width: 800px; margin: 0 auto; padding: 24px; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.header h1 { font-size: 1.5rem; }
.connect-btn {
  padding: 12px 24px;
  background: var(--accent);
  border: none;
  border-radius: 12px;
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.connect-btn:hover { opacity: 0.9; }
.connect-btn.connected { background: var(--green); }
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
.summary-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-label { font-size: 0.875rem; color: var(--text-secondary); }
.summary-value { font-size: 1.75rem; font-weight: 700; }
.summary-change { font-size: 0.875rem; font-weight: 500; }
.summary-change.positive { color: var(--green); }
.summary-change.negative { color: var(--red); }
.holdings-section {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}
.section-header h2 { font-size: 1rem; }
.add-btn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
}
.add-btn:hover { background: var(--border); }
.holdings-list { padding: 12px; }
.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--text-secondary);
}
.empty-state span { font-size: 3rem; display: block; margin-bottom: 16px; }
.holding-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  margin-bottom: 8px;
  transition: background 0.2s;
}
.holding-item:hover { background: rgba(255,255,255,0.05); }
.holding-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.holding-info { flex: 1; }
.holding-name { font-weight: 600; }
.holding-amount { font-size: 0.875rem; color: var(--text-secondary); }
.holding-value { text-align: right; }
.holding-usd { font-weight: 600; }
.holding-change { font-size: 0.875rem; }
.holding-change.positive { color: var(--green); }
.holding-change.negative { color: var(--red); }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
.modal.hidden { display: none; }
.modal-content {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}
.modal-content h3 { margin-bottom: 20px; }
.modal-content input {
  width: 100%;
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  font-size: 1rem;
  margin-bottom: 12px;
}
.modal-actions { display: flex; gap: 12px; margin-top: 8px; }
.modal-actions button { flex: 1; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer; }
.cancel-btn { background: transparent; border: 1px solid var(--border); color: var(--text); }
.confirm-btn { background: var(--accent); border: none; color: var(--text); }
@media (max-width: 640px) {
  .summary-cards { grid-template-columns: 1fr; }
}` },
      { name: 'app.js', language: 'javascript', content: `/**
 * Crypto Portfolio Tracker
 * Tracks holdings and fetches live prices from CoinGecko
 */

// Portfolio state
let portfolio = {
  holdings: [],
  connected: false,
  account: null
};

// Token ID mapping for CoinGecko
const tokenIds = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'SOL': 'solana',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave'
};

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const holdingsList = document.getElementById('holdings-list');
const totalValue = document.getElementById('total-value');
const totalChange = document.getElementById('total-change');
const dayChange = document.getElementById('day-change');
const assetCount = document.getElementById('asset-count');
const addBtn = document.getElementById('add-btn');
const addModal = document.getElementById('add-modal');
const cancelAdd = document.getElementById('cancel-add');
const confirmAdd = document.getElementById('confirm-add');

// Fetch prices from CoinGecko
async function fetchPrices(ids) {
  try {
    const res = await fetch(
      \`https://api.coingecko.com/api/v3/simple/price?ids=\${ids.join(',')}&vs_currencies=usd&include_24hr_change=true\`
    );
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch prices:', err);
    return {};
  }
}

// Calculate and update portfolio
async function updatePortfolio() {
  if (portfolio.holdings.length === 0) {
    holdingsList.innerHTML = \`
      <div class="empty-state">
        <span>📊</span>
        <p>Connect wallet or add assets manually</p>
      </div>
    \`;
    totalValue.textContent = '$0.00';
    totalChange.textContent = '+0.00%';
    dayChange.textContent = '$0.00';
    assetCount.textContent = '0';
    return;
  }
  
  // Get token IDs for API
  const ids = portfolio.holdings
    .map(h => tokenIds[h.symbol.toUpperCase()])
    .filter(Boolean);
  
  // Fetch prices
  const prices = await fetchPrices(ids);
  
  // Calculate values
  let total = 0;
  let totalChangeAmount = 0;
  
  const holdingsHtml = portfolio.holdings.map(holding => {
    const id = tokenIds[holding.symbol.toUpperCase()];
    const priceData = prices[id] || { usd: 0, usd_24h_change: 0 };
    const value = holding.amount * priceData.usd;
    const change = priceData.usd_24h_change || 0;
    const changeAmount = value * (change / 100);
    
    total += value;
    totalChangeAmount += changeAmount;
    
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeSign = change >= 0 ? '+' : '';
    
    return \`
      <div class="holding-item">
        <div class="holding-icon">\${getTokenEmoji(holding.symbol)}</div>
        <div class="holding-info">
          <div class="holding-name">\${holding.symbol.toUpperCase()}</div>
          <div class="holding-amount">\${holding.amount.toLocaleString()} tokens</div>
        </div>
        <div class="holding-value">
          <div class="holding-usd">$\${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="holding-change \${changeClass}">\${changeSign}\${change.toFixed(2)}%</div>
        </div>
      </div>
    \`;
  }).join('');
  
  holdingsList.innerHTML = holdingsHtml;
  
  // Update summary
  const totalChangePercent = total > 0 ? (totalChangeAmount / (total - totalChangeAmount)) * 100 : 0;
  const changeClass = totalChangePercent >= 0 ? 'positive' : 'negative';
  const changeSign = totalChangePercent >= 0 ? '+' : '';
  
  totalValue.textContent = '$' + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  totalChange.textContent = changeSign + totalChangePercent.toFixed(2) + '%';
  totalChange.className = 'summary-change ' + changeClass;
  dayChange.textContent = (totalChangeAmount >= 0 ? '+$' : '-$') + Math.abs(totalChangeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  dayChange.style.color = totalChangeAmount >= 0 ? 'var(--green)' : 'var(--red)';
  assetCount.textContent = portfolio.holdings.length.toString();
  
  console.log('📊 Portfolio updated:', { total, change: totalChangePercent.toFixed(2) + '%' });
}

// Get emoji for token
function getTokenEmoji(symbol) {
  const emojis = {
    'ETH': '⟠', 'BTC': '₿', 'USDC': '💵', 'USDT': '💲',
    'SOL': '◎', 'MATIC': '🟣', 'BNB': '🔶', 'LINK': '🔗',
    'UNI': '🦄', 'AAVE': '👻'
  };
  return emojis[symbol.toUpperCase()] || '🪙';
}

// Connect wallet
async function connectWallet() {
  if (!window.ethereum) {
    alert('Please install MetaMask!');
    return;
  }
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    portfolio.connected = true;
    portfolio.account = accounts[0];
    
    connectBtn.textContent = accounts[0].slice(0, 6) + '...' + accounts[0].slice(-4);
    connectBtn.classList.add('connected');
    
    // Add some demo holdings for connected wallet
    portfolio.holdings = [
      { symbol: 'ETH', amount: 2.5 },
      { symbol: 'USDC', amount: 1000 },
      { symbol: 'LINK', amount: 50 }
    ];
    
    updatePortfolio();
    console.log('🔗 Wallet connected:', portfolio.account);
  } catch (err) {
    console.error('Failed to connect:', err);
  }
}

// Add asset manually
function addAsset() {
  const symbol = document.getElementById('asset-symbol').value.trim();
  const amount = parseFloat(document.getElementById('asset-amount').value);
  
  if (!symbol || !amount || amount <= 0) {
    alert('Please enter valid symbol and amount');
    return;
  }
  
  portfolio.holdings.push({ symbol: symbol.toUpperCase(), amount });
  addModal.classList.add('hidden');
  document.getElementById('asset-symbol').value = '';
  document.getElementById('asset-amount').value = '';
  
  updatePortfolio();
  console.log('➕ Added asset:', symbol, amount);
}

// Event Listeners
connectBtn.addEventListener('click', connectWallet);
addBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
cancelAdd.addEventListener('click', () => addModal.classList.add('hidden'));
confirmAdd.addEventListener('click', addAsset);

// Initialize
console.log('💼 Portfolio Tracker initialized');
updatePortfolio();
setInterval(updatePortfolio, 60000); // Refresh every minute` }
    ]
  },
  {
    id: 'gas-tracker',
    name: 'Gas Price Monitor',
    description: 'Real-time Ethereum gas prices and estimates',
    category: 'web3',
    difficulty: 'beginner',
    examplePrompts: ['Gas tracker', 'Gas prices', 'Ethereum gas', 'Transaction cost'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gas Tracker</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>⛽ Gas Tracker</h1>
      <p class="subtitle">Real-time Ethereum gas prices</p>
    </header>
    
    <!-- Gas Price Cards -->
    <div class="gas-cards">
      <div class="gas-card slow">
        <div class="gas-icon">🐢</div>
        <div class="gas-label">Slow</div>
        <div class="gas-price" id="slow-gas">--</div>
        <div class="gas-time">~10 min</div>
      </div>
      <div class="gas-card standard">
        <div class="gas-icon">🚗</div>
        <div class="gas-label">Standard</div>
        <div class="gas-price" id="standard-gas">--</div>
        <div class="gas-time">~3 min</div>
      </div>
      <div class="gas-card fast">
        <div class="gas-icon">🚀</div>
        <div class="gas-label">Fast</div>
        <div class="gas-price" id="fast-gas">--</div>
        <div class="gas-time">~30 sec</div>
      </div>
    </div>
    
    <!-- Cost Estimator -->
    <div class="estimator">
      <h2>💰 Transaction Cost Estimator</h2>
      <div class="estimator-grid">
        <div class="estimate-item">
          <span class="estimate-label">ETH Transfer</span>
          <span class="estimate-value" id="eth-transfer">--</span>
        </div>
        <div class="estimate-item">
          <span class="estimate-label">ERC-20 Transfer</span>
          <span class="estimate-value" id="erc20-transfer">--</span>
        </div>
        <div class="estimate-item">
          <span class="estimate-label">Uniswap Swap</span>
          <span class="estimate-value" id="uniswap-swap">--</span>
        </div>
        <div class="estimate-item">
          <span class="estimate-label">NFT Mint</span>
          <span class="estimate-value" id="nft-mint">--</span>
        </div>
      </div>
    </div>
    
    <!-- Status -->
    <div class="status">
      <span class="status-dot"></span>
      <span id="status-text">Connecting...</span>
      <span class="last-update">Updated: <span id="last-update">--</span></span>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `:root {
  --bg: #0a0a0f;
  --card: #12121a;
  --border: #1f1f2e;
  --text: #fff;
  --text-secondary: #6b7280;
  --slow: #f59e0b;
  --standard: #3b82f6;
  --fast: #10b981;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
#app { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
header { text-align: center; margin-bottom: 32px; }
header h1 { font-size: 2rem; margin-bottom: 8px; }
.subtitle { color: var(--text-secondary); }
.gas-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
.gas-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  transition: transform 0.2s, border-color 0.2s;
}
.gas-card:hover { transform: translateY(-4px); }
.gas-card.slow:hover { border-color: var(--slow); }
.gas-card.standard:hover { border-color: var(--standard); }
.gas-card.fast:hover { border-color: var(--fast); }
.gas-icon { font-size: 2rem; margin-bottom: 8px; }
.gas-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.gas-price {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.slow .gas-price { color: var(--slow); }
.standard .gas-price { color: var(--standard); }
.fast .gas-price { color: var(--fast); }
.gas-time { font-size: 0.75rem; color: var(--text-secondary); }
.estimator {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}
.estimator h2 { font-size: 1rem; margin-bottom: 20px; }
.estimator-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.estimate-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
}
.estimate-label { color: var(--text-secondary); font-size: 0.875rem; }
.estimate-value { font-weight: 600; }
.status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fast);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.last-update { margin-left: auto; }
@media (max-width: 480px) {
  .gas-cards { grid-template-columns: 1fr; }
  .estimator-grid { grid-template-columns: 1fr; }
}` },
      { name: 'app.js', language: 'javascript', content: `/**
 * Ethereum Gas Tracker
 * Fetches real-time gas prices from Etherscan API
 */

// API (free tier - replace with your key for production)
const ETHERSCAN_API = 'https://api.etherscan.io/api?module=gastracker&action=gasoracle';
const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

// Gas usage estimates (in gas units)
const GAS_ESTIMATES = {
  ethTransfer: 21000,
  erc20Transfer: 65000,
  uniswapSwap: 150000,
  nftMint: 120000
};

// State
let state = {
  gasPrices: { slow: 0, standard: 0, fast: 0 },
  ethPrice: 0
};

// DOM Elements
const slowGas = document.getElementById('slow-gas');
const standardGas = document.getElementById('standard-gas');
const fastGas = document.getElementById('fast-gas');
const ethTransfer = document.getElementById('eth-transfer');
const erc20Transfer = document.getElementById('erc20-transfer');
const uniswapSwap = document.getElementById('uniswap-swap');
const nftMint = document.getElementById('nft-mint');
const statusText = document.getElementById('status-text');
const lastUpdate = document.getElementById('last-update');

// Fetch gas prices
async function fetchGasPrices() {
  try {
    const res = await fetch(ETHERSCAN_API);
    const data = await res.json();
    
    if (data.status === '1' && data.result) {
      state.gasPrices = {
        slow: parseInt(data.result.SafeGasPrice),
        standard: parseInt(data.result.ProposeGasPrice),
        fast: parseInt(data.result.FastGasPrice)
      };
      return true;
    }
    throw new Error('Invalid response');
  } catch (err) {
    console.error('Failed to fetch gas:', err);
    // Use simulated data if API fails
    state.gasPrices = {
      slow: 15 + Math.floor(Math.random() * 5),
      standard: 20 + Math.floor(Math.random() * 5),
      fast: 30 + Math.floor(Math.random() * 10)
    };
    return true;
  }
}

// Fetch ETH price
async function fetchEthPrice() {
  try {
    const res = await fetch(ETH_PRICE_API);
    const data = await res.json();
    state.ethPrice = data.ethereum.usd;
  } catch (err) {
    console.error('Failed to fetch ETH price:', err);
    state.ethPrice = 2500; // Fallback
  }
}

// Calculate transaction cost in USD
function calcCost(gasUnits, gasPrice) {
  // gasPrice is in Gwei, convert to ETH then to USD
  const ethCost = (gasUnits * gasPrice) / 1e9;
  const usdCost = ethCost * state.ethPrice;
  return usdCost;
}

// Update UI
function updateUI() {
  // Update gas price cards
  slowGas.textContent = state.gasPrices.slow + ' Gwei';
  standardGas.textContent = state.gasPrices.standard + ' Gwei';
  fastGas.textContent = state.gasPrices.fast + ' Gwei';
  
  // Update cost estimates (using standard gas price)
  const gasPrice = state.gasPrices.standard;
  
  ethTransfer.textContent = '$' + calcCost(GAS_ESTIMATES.ethTransfer, gasPrice).toFixed(2);
  erc20Transfer.textContent = '$' + calcCost(GAS_ESTIMATES.erc20Transfer, gasPrice).toFixed(2);
  uniswapSwap.textContent = '$' + calcCost(GAS_ESTIMATES.uniswapSwap, gasPrice).toFixed(2);
  nftMint.textContent = '$' + calcCost(GAS_ESTIMATES.nftMint, gasPrice).toFixed(2);
  
  // Update status
  statusText.textContent = 'Connected to Ethereum';
  lastUpdate.textContent = new Date().toLocaleTimeString();
  
  console.log('⛽ Gas prices updated:', state.gasPrices);
}

// Initial fetch and setup refresh
async function init() {
  console.log('⛽ Gas Tracker initializing...');
  
  await Promise.all([fetchGasPrices(), fetchEthPrice()]);
  updateUI();
  
  // Refresh every 15 seconds
  setInterval(async () => {
    await fetchGasPrices();
    updateUI();
  }, 15000);
  
  // Refresh ETH price every minute
  setInterval(fetchEthPrice, 60000);
}

init();` }
    ]
  },
  {
    id: 'ens-lookup',
    name: 'ENS Domain Lookup',
    description: 'Resolve ENS names and reverse lookup addresses',
    category: 'web3',
    difficulty: 'beginner',
    examplePrompts: ['ENS lookup', 'ENS resolver', 'Domain lookup', 'Ethereum names'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ENS Lookup</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <div class="logo">🔮</div>
      <h1>ENS Lookup</h1>
      <p>Resolve Ethereum Name Service domains</p>
    </header>
    
    <!-- Search -->
    <div class="search-box">
      <input 
        type="text" 
        id="search-input" 
        placeholder="Enter ENS name or address (e.g., vitalik.eth)"
        autocomplete="off"
      >
      <button id="search-btn">🔍</button>
    </div>
    
    <!-- Results -->
    <div class="results hidden" id="results">
      <div class="result-card">
        <div class="result-avatar" id="avatar">🧑</div>
        <div class="result-main">
          <h2 id="result-name">--</h2>
          <p class="result-address" id="result-address">--</p>
        </div>
      </div>
      
      <!-- Additional Info -->
      <div class="info-grid" id="info-grid">
        <!-- Dynamic content -->
      </div>
    </div>
    
    <!-- Loading -->
    <div class="loading hidden" id="loading">
      <div class="spinner"></div>
      <p>Resolving...</p>
    </div>
    
    <!-- Error -->
    <div class="error hidden" id="error">
      <span>❌</span>
      <p id="error-message">Not found</p>
    </div>
    
    <!-- Recent Lookups -->
    <div class="recent" id="recent">
      <h3>Recent Lookups</h3>
      <div class="recent-list" id="recent-list">
        <button class="recent-item" data-query="vitalik.eth">vitalik.eth</button>
        <button class="recent-item" data-query="nick.eth">nick.eth</button>
        <button class="recent-item" data-query="brantly.eth">brantly.eth</button>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `:root {
  --bg: #0a0a0f;
  --card: #12121a;
  --border: #1f1f2e;
  --text: #fff;
  --text-secondary: #6b7280;
  --accent: #5865f2;
  --accent-light: #7289da;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
#app { max-width: 500px; margin: 0 auto; padding: 48px 24px; }
header { text-align: center; margin-bottom: 32px; }
.logo { font-size: 3rem; margin-bottom: 16px; }
header h1 { font-size: 1.75rem; margin-bottom: 8px; }
header p { color: var(--text-secondary); }
.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.search-box input {
  flex: 1;
  padding: 16px 20px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}
.search-box input:focus { border-color: var(--accent); }
.search-box button {
  padding: 16px 24px;
  background: var(--accent);
  border: none;
  border-radius: 16px;
  font-size: 1.25rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.search-box button:hover { opacity: 0.9; }
.results {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
}
.result-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.result-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  overflow: hidden;
}
.result-avatar img { width: 100%; height: 100%; object-fit: cover; }
.result-main h2 { font-size: 1.25rem; margin-bottom: 4px; }
.result-address {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-family: monospace;
  word-break: break-all;
}
.info-grid {
  display: grid;
  gap: 12px;
}
.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255,255,255,0.02);
  border-radius: 10px;
}
.info-label { color: var(--text-secondary); font-size: 0.875rem; }
.info-value {
  font-weight: 500;
  font-size: 0.875rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.info-value a { color: var(--accent-light); text-decoration: none; }
.info-value a:hover { text-decoration: underline; }
.loading, .error {
  text-align: center;
  padding: 48px;
  color: var(--text-secondary);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error span { font-size: 2rem; display: block; margin-bottom: 8px; }
.hidden { display: none !important; }
.recent { margin-top: 32px; }
.recent h3 { font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 12px; }
.recent-list { display: flex; flex-wrap: wrap; gap: 8px; }
.recent-item {
  padding: 8px 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s;
}
.recent-item:hover { border-color: var(--accent); }` },
      { name: 'app.js', language: 'javascript', content: `/**
 * ENS Domain Lookup
 * Uses ENS public resolver and metadata service
 */

// ENS APIs
const ENS_METADATA = 'https://metadata.ens.domains/mainnet';
const ENS_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens';

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const results = document.getElementById('results');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const resultName = document.getElementById('result-name');
const resultAddress = document.getElementById('result-address');
const avatar = document.getElementById('avatar');
const infoGrid = document.getElementById('info-grid');
const recentList = document.getElementById('recent-list');

// Recent lookups
let recentLookups = ['vitalik.eth', 'nick.eth', 'brantly.eth'];

// Resolve ENS name to address
async function resolveENS(name) {
  try {
    // Use ENS metadata API
    const res = await fetch(\`\${ENS_METADATA}/avatar/\${name}/meta\`);
    if (!res.ok) throw new Error('Not found');
    
    const data = await res.json();
    return data;
  } catch (err) {
    // Fallback: Try direct resolution via public node
    console.log('Metadata failed, trying fallback...');
    return null;
  }
}

// Reverse lookup address to ENS
async function reverseResolve(address) {
  // Simplified - in production use ethers.js or web3.js
  return null;
}

// Fetch ENS records
async function fetchRecords(name) {
  try {
    const res = await fetch(\`\${ENS_METADATA}/\${name}\`);
    if (!res.ok) throw new Error('No records');
    return await res.json();
  } catch {
    return null;
  }
}

// Display results
function showResults(data, query) {
  results.classList.remove('hidden');
  loading.classList.add('hidden');
  error.classList.add('hidden');
  
  // Set name and address
  resultName.textContent = data.name || query;
  resultAddress.textContent = data.address || 'Could not resolve address';
  
  // Set avatar
  if (data.avatar) {
    avatar.innerHTML = \`<img src="\${data.avatar}" alt="avatar">\`;
  } else {
    avatar.innerHTML = '🧑';
  }
  
  // Build info grid
  let infoHtml = '';
  
  if (data.address) {
    infoHtml += \`
      <div class="info-item">
        <span class="info-label">Address</span>
        <span class="info-value">
          <a href="https://etherscan.io/address/\${data.address}" target="_blank">
            \${data.address.slice(0, 8)}...\${data.address.slice(-6)}
          </a>
        </span>
      </div>
    \`;
  }
  
  if (data.records?.url) {
    infoHtml += \`
      <div class="info-item">
        <span class="info-label">Website</span>
        <span class="info-value">
          <a href="\${data.records.url}" target="_blank">\${data.records.url}</a>
        </span>
      </div>
    \`;
  }
  
  if (data.records?.twitter || data.records?.['com.twitter']) {
    const twitter = data.records?.twitter || data.records?.['com.twitter'];
    infoHtml += \`
      <div class="info-item">
        <span class="info-label">Twitter</span>
        <span class="info-value">
          <a href="https://twitter.com/\${twitter}" target="_blank">@\${twitter}</a>
        </span>
      </div>
    \`;
  }
  
  if (data.records?.github || data.records?.['com.github']) {
    const github = data.records?.github || data.records?.['com.github'];
    infoHtml += \`
      <div class="info-item">
        <span class="info-label">GitHub</span>
        <span class="info-value">
          <a href="https://github.com/\${github}" target="_blank">\${github}</a>
        </span>
      </div>
    \`;
  }
  
  if (data.records?.email) {
    infoHtml += \`
      <div class="info-item">
        <span class="info-label">Email</span>
        <span class="info-value">\${data.records.email}</span>
      </div>
    \`;
  }
  
  // Always show ENS app link
  infoHtml += \`
    <div class="info-item">
      <span class="info-label">ENS App</span>
      <span class="info-value">
        <a href="https://app.ens.domains/\${query}" target="_blank">View on ENS →</a>
      </span>
    </div>
  \`;
  
  infoGrid.innerHTML = infoHtml || '<p style="color: var(--text-secondary); text-align: center;">No additional records found</p>';
}

// Show error
function showError(message) {
  results.classList.add('hidden');
  loading.classList.add('hidden');
  error.classList.remove('hidden');
  errorMessage.textContent = message;
}

// Search handler
async function search(query) {
  if (!query) return;
  
  query = query.trim().toLowerCase();
  
  // Add .eth if missing
  if (!query.includes('.') && !query.startsWith('0x')) {
    query += '.eth';
  }
  
  console.log('🔍 Looking up:', query);
  
  // Show loading
  results.classList.add('hidden');
  error.classList.add('hidden');
  loading.classList.remove('hidden');
  
  try {
    // Check if address or name
    if (query.startsWith('0x')) {
      // Reverse lookup
      const name = await reverseResolve(query);
      if (name) {
        query = name;
      } else {
        showError('No ENS name found for this address');
        return;
      }
    }
    
    // Fetch metadata and records
    const [metadata, records] = await Promise.all([
      resolveENS(query),
      fetchRecords(query)
    ]);
    
    if (!metadata && !records) {
      showError('ENS name not found or has no records');
      return;
    }
    
    const data = {
      name: query,
      address: metadata?.address || records?.address,
      avatar: metadata?.avatar || records?.avatar,
      records: records?.records || {}
    };
    
    showResults(data, query);
    
    // Add to recent
    if (!recentLookups.includes(query)) {
      recentLookups.unshift(query);
      recentLookups = recentLookups.slice(0, 5);
      updateRecentList();
    }
    
  } catch (err) {
    console.error('Lookup failed:', err);
    showError('Failed to lookup ENS name');
  }
}

// Update recent list
function updateRecentList() {
  recentList.innerHTML = recentLookups.map(q => 
    \`<button class="recent-item" data-query="\${q}">\${q}</button>\`
  ).join('');
}

// Event listeners
searchBtn.addEventListener('click', () => search(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') search(searchInput.value);
});

recentList.addEventListener('click', (e) => {
  if (e.target.classList.contains('recent-item')) {
    const query = e.target.dataset.query;
    searchInput.value = query;
    search(query);
  }
});

// Initialize
console.log('🔮 ENS Lookup ready');` }
    ]
  },
  {
    id: 'nft-minter',
    name: 'NFT Minter UI',
    description: 'Mint NFTs with MetaMask',
    category: 'web3',
    difficulty: 'intermediate',
    examplePrompts: ['NFT minting', 'Mint NFT UI', 'NFT frontend'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NFT Minter</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="minter">
    <h1>🎨 NFT Minter</h1>
    <div class="preview">
      <img id="preview-img" src="https://picsum.photos/300/300" alt="NFT Preview">
    </div>
    <div class="controls">
      <input type="text" id="name" placeholder="NFT Name">
      <input type="text" id="description" placeholder="Description">
      <div class="price">Price: 0.01 ETH</div>
      <button id="mint-btn">Mint NFT</button>
    </div>
    <div id="status"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  font-family: system-ui, sans-serif;
}
.minter {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 40px;
  text-align: center;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.1);
}
h1 { margin-bottom: 24px; }
.preview {
  width: 300px;
  height: 300px;
  margin: 0 auto 24px;
  border-radius: 16px;
  overflow: hidden;
}
.preview img { width: 100%; height: 100%; object-fit: cover; }
.controls { display: flex; flex-direction: column; gap: 12px; }
input {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
  color: #fff;
  font-size: 16px;
}
.price { padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px; }
button {
  padding: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
}
#status { margin-top: 16px; font-size: 14px; }` },
      { name: 'app.js', language: 'javascript', content: `const mintBtn = document.getElementById('mint-btn');
const status = document.getElementById('status');

async function mint() {
  if (!window.ethereum) {
    status.textContent = '❌ Please install MetaMask';
    return;
  }
  
  const name = document.getElementById('name').value;
  const desc = document.getElementById('description').value;
  
  if (!name) {
    status.textContent = '❌ Please enter a name';
    return;
  }
  
  status.textContent = '🔄 Connecting wallet...';
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    status.textContent = '🔄 Preparing transaction...';
    
    // Simulated mint - replace with actual contract call
    await new Promise(r => setTimeout(r, 2000));
    
    status.innerHTML = '✅ NFT Minted!<br>Name: ' + name + '<br>Owner: ' + accounts[0].slice(0,10) + '...';
    console.log('Minted NFT:', { name, desc, owner: accounts[0] });
  } catch (err) {
    status.textContent = '❌ ' + (err.message || 'Minting failed');
    console.error(err);
  }
}

mintBtn.addEventListener('click', mint);` }
    ]
  },

  // === UI TEMPLATES ===
  {
    id: 'dashboard',
    name: 'Dashboard Layout',
    description: 'Responsive admin dashboard',
    category: 'ui',
    difficulty: 'intermediate',
    examplePrompts: ['Dashboard', 'Admin panel', 'Analytics dashboard'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <aside class="sidebar">
    <h2>📊 Dashboard</h2>
    <nav>
      <a href="#" class="active">Overview</a>
      <a href="#">Analytics</a>
      <a href="#">Users</a>
      <a href="#">Settings</a>
    </nav>
  </aside>
  <main class="content">
    <header><h1>Overview</h1></header>
    <div class="cards">
      <div class="card"><h3>Users</h3><p class="big">12,345</p></div>
      <div class="card"><h3>Revenue</h3><p class="big">$45.2K</p></div>
      <div class="card"><h3>Orders</h3><p class="big">892</p></div>
      <div class="card"><h3>Growth</h3><p class="big">+24%</p></div>
    </div>
  </main>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; min-height: 100vh; font-family: system-ui, sans-serif; background: #f5f5f5; }
.sidebar {
  width: 240px;
  background: #1a1a2e;
  color: #fff;
  padding: 24px;
}
.sidebar h2 { margin-bottom: 32px; }
.sidebar nav { display: flex; flex-direction: column; gap: 8px; }
.sidebar a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  padding: 12px 16px;
  border-radius: 8px;
  transition: all 0.2s;
}
.sidebar a:hover, .sidebar a.active { background: rgba(255,255,255,0.1); color: #fff; }
.content { flex: 1; padding: 32px; }
header { margin-bottom: 32px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; }
.card {
  background: #fff;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.card h3 { color: #666; font-size: 14px; margin-bottom: 8px; }
.card .big { font-size: 32px; font-weight: 700; color: #1a1a2e; }` },
      { name: 'app.js', language: 'javascript', content: `// Add interactivity here
console.log('Dashboard loaded');` }
    ]
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Modern product landing page',
    category: 'ui',
    difficulty: 'beginner',
    examplePrompts: ['Landing page', 'Product page', 'Marketing page'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Landing</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <nav>
      <div class="logo">🚀 Product</div>
      <div class="links">
        <a href="#">Features</a>
        <a href="#">Pricing</a>
        <a href="#">About</a>
        <button class="cta-small">Get Started</button>
      </div>
    </nav>
  </header>
  <section class="hero">
    <h1>Build Something Amazing</h1>
    <p>The fastest way to create, deploy, and scale your next big idea.</p>
    <button class="cta">Start Free Trial</button>
  </section>
  <section class="features">
    <div class="feature">⚡ Lightning Fast</div>
    <div class="feature">🔒 Secure by Default</div>
    <div class="feature">🌍 Global Scale</div>
  </section>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }
header {
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}
nav { display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 1200px; margin: 0 auto; }
.logo { font-size: 24px; font-weight: 700; }
.links { display: flex; gap: 24px; align-items: center; }
.links a { color: #333; text-decoration: none; }
.cta-small { padding: 10px 20px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
.hero {
  text-align: center;
  padding: 120px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}
.hero h1 { font-size: 48px; margin-bottom: 16px; }
.hero p { font-size: 20px; opacity: 0.9; margin-bottom: 32px; }
.cta { padding: 16px 40px; font-size: 18px; background: #fff; color: #667eea; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; }
.features { display: flex; justify-content: center; gap: 48px; padding: 80px 20px; }
.feature { font-size: 20px; font-weight: 600; }` },
      { name: 'app.js', language: 'javascript', content: `console.log('Landing page loaded');` }
    ]
  },

  // === API / UTILITY TEMPLATES ===
  {
    id: 'fetch-api',
    name: 'API Fetch Example',
    description: 'Fetch data from REST API',
    category: 'api',
    difficulty: 'beginner',
    examplePrompts: ['Fetch API', 'REST API', 'HTTP request'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Demo</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>🌐 API Demo</h1>
    <button id="fetch-btn">Fetch Users</button>
    <div id="loading" class="hidden">Loading...</div>
    <ul id="users"></ul>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `.container {
  max-width: 600px;
  margin: 50px auto;
  padding: 40px;
  font-family: system-ui, sans-serif;
}
h1 { margin-bottom: 24px; }
button { padding: 12px 24px; font-size: 16px; cursor: pointer; }
.hidden { display: none; }
#users { list-style: none; padding: 0; margin-top: 24px; }
#users li {
  padding: 16px;
  background: #f5f5f5;
  margin-bottom: 8px;
  border-radius: 8px;
}
#users li strong { color: #333; }` },
      { name: 'app.js', language: 'javascript', content: `const fetchBtn = document.getElementById('fetch-btn');
const loading = document.getElementById('loading');
const usersList = document.getElementById('users');

async function fetchUsers() {
  loading.classList.remove('hidden');
  usersList.innerHTML = '';
  
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/users');
    const users = await res.json();
    
    users.forEach(user => {
      const li = document.createElement('li');
      li.innerHTML = '<strong>' + user.name + '</strong><br>' + user.email;
      usersList.appendChild(li);
    });
    
    console.log('Fetched', users.length, 'users');
  } catch (err) {
    usersList.innerHTML = '<li>Error loading users</li>';
    console.error(err);
  } finally {
    loading.classList.add('hidden');
  }
}

fetchBtn.addEventListener('click', fetchUsers);` }
    ]
  },
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Simple todo list with local storage',
    category: 'utility',
    difficulty: 'beginner',
    examplePrompts: ['Todo app', 'Task list', 'Todo list'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>✅ Todo List</h1>
    <div class="input-group">
      <input type="text" id="todo-input" placeholder="Add a task...">
      <button id="add-btn">Add</button>
    </div>
    <ul id="todos"></ul>
    <p class="count"><span id="count">0</span> tasks remaining</p>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `.container {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  font-family: system-ui, sans-serif;
}
h1 { text-align: center; margin-bottom: 24px; }
.input-group { display: flex; gap: 8px; margin-bottom: 24px; }
input {
  flex: 1;
  padding: 12px;
  border: 2px solid #eee;
  border-radius: 8px;
  font-size: 16px;
}
button { padding: 12px 20px; background: #667eea; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
#todos { list-style: none; padding: 0; }
#todos li {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f9f9f9;
  margin-bottom: 8px;
  border-radius: 8px;
}
#todos li.done span { text-decoration: line-through; opacity: 0.5; }
#todos li span { flex: 1; }
#todos li button { background: #ff4757; padding: 6px 12px; font-size: 12px; }
.count { text-align: center; color: #999; margin-top: 16px; }` },
      { name: 'app.js', language: 'javascript', content: `const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todosList = document.getElementById('todos');
const countEl = document.getElementById('count');

let todos = JSON.parse(localStorage.getItem('todos') || '[]');

function render() {
  todosList.innerHTML = '';
  todos.forEach((todo, i) => {
    const li = document.createElement('li');
    li.className = todo.done ? 'done' : '';
    li.innerHTML = \`
      <input type="checkbox" \${todo.done ? 'checked' : ''} onchange="toggle(\${i})">
      <span>\${todo.text}</span>
      <button onclick="remove(\${i})">Delete</button>
    \`;
    todosList.appendChild(li);
  });
  countEl.textContent = todos.filter(t => !t.done).length;
  localStorage.setItem('todos', JSON.stringify(todos));
}

function add() {
  const text = input.value.trim();
  if (!text) return;
  todos.push({ text, done: false });
  input.value = '';
  render();
}

window.toggle = (i) => { todos[i].done = !todos[i].done; render(); };
window.remove = (i) => { todos.splice(i, 1); render(); };

addBtn.addEventListener('click', add);
input.addEventListener('keypress', e => e.key === 'Enter' && add());

render();` }
    ]
  },

  // === GAME TEMPLATE ===
  {
    id: 'canvas-game',
    name: 'Canvas Game',
    description: 'Simple canvas-based game starter',
    category: 'game',
    difficulty: 'intermediate',
    examplePrompts: ['Canvas game', 'Simple game', 'Game starter'],
    files: [
      { name: 'index.html', language: 'html', isEntry: true, content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Game</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="game-container">
    <canvas id="game" width="400" height="400"></canvas>
    <p>Use arrow keys to move</p>
    <p>Score: <span id="score">0</span></p>
  </div>
  <script src="app.js"></script>
</body>
</html>` },
      { name: 'styles.css', language: 'css', content: `body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  font-family: system-ui, sans-serif;
  color: #fff;
}
.game-container { text-align: center; }
canvas { background: #16213e; border-radius: 8px; display: block; margin: 0 auto 16px; }
p { margin: 8px 0; }` },
      { name: 'app.js', language: 'javascript', content: `const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

let player = { x: 200, y: 200, size: 20, speed: 5 };
let target = { x: 100, y: 100, size: 15 };
let score = 0;
let keys = {};

function randomPos() {
  return {
    x: Math.random() * (canvas.width - 30) + 15,
    y: Math.random() * (canvas.height - 30) + 15
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Player
  ctx.fillStyle = '#667eea';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();
  
  // Target
  ctx.fillStyle = '#f5af19';
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.size, 0, Math.PI * 2);
  ctx.fill();
}

function update() {
  if (keys['ArrowUp']) player.y -= player.speed;
  if (keys['ArrowDown']) player.y += player.speed;
  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;
  
  // Bounds
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
  
  // Collision
  const dx = player.x - target.x;
  const dy = player.y - target.y;
  if (Math.sqrt(dx*dx + dy*dy) < player.size + target.size) {
    score++;
    scoreEl.textContent = score;
    const pos = randomPos();
    target.x = pos.x;
    target.y = pos.y;
    console.log('Score:', score);
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

loop();
console.log('🎮 Game started! Use arrow keys to catch the target.');` }
    ]
  }
];

// Search templates by query
export function searchWebTemplates(query: string): WebTemplate[] {
  const q = query.toLowerCase();
  return webTemplates.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    t.examplePrompts.some(p => p.toLowerCase().includes(q))
  );
}

// Get templates by category
export function getWebTemplatesByCategory(category: WebTemplate['category']): WebTemplate[] {
  return webTemplates.filter(t => t.category === category);
}
