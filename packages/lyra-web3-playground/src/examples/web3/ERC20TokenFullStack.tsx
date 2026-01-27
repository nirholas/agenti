/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The best code comes from the heart ❤️
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'MyToken.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyToken - ERC20 Token with mint and burn
/// @notice A fully-featured fungible token
contract MyToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        require(initialSupply <= MAX_SUPPLY, "Exceeds max supply");
        _mint(msg.sender, initialSupply);
    }
    
    /// @notice Mint new tokens (owner only)
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /// @notice Burn tokens from caller
    /// @param amount Amount to burn
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /// @notice Get token info
    function getTokenInfo() public view returns (
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply,
        uint256 _maxSupply
    ) {
        return (name(), symbol(), decimals(), totalSupply(), MAX_SUPPLY);
    }
}`
  },
  {
    id: 'html',
    name: 'index.html',
    language: 'html',
    code: `<div class="app">
  <div class="card">
    <div class="header">
      <div class="token-logo">🪙</div>
      <h1 id="tokenName">My Token</h1>
      <p id="tokenSymbol">MTK</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Supply</span>
        <span id="totalSupply" class="stat-value">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Your Balance</span>
        <span id="yourBalance" class="stat-value">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Max Supply</span>
        <span id="maxSupply" class="stat-value">1,000,000,000</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Decimals</span>
        <span id="decimals" class="stat-value">18</span>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" data-tab="transfer">Transfer</button>
      <button class="tab" data-tab="mint">Mint</button>
      <button class="tab" data-tab="burn">Burn</button>
    </div>
    
    <!-- Transfer Tab -->
    <div id="transfer-panel" class="tab-panel active">
      <div class="form-group">
        <label>Recipient Address</label>
        <input type="text" id="transferTo" placeholder="0x..." />
      </div>
      <div class="form-group">
        <label>Amount</label>
        <div class="input-with-max">
          <input type="number" id="transferAmount" placeholder="0.0" />
          <button id="transferMax" class="max-btn">MAX</button>
        </div>
      </div>
      <button id="transferBtn" class="action-btn">Transfer</button>
    </div>
    
    <!-- Mint Tab -->
    <div id="mint-panel" class="tab-panel">
      <div class="form-group">
        <label>Mint To Address</label>
        <input type="text" id="mintTo" placeholder="0x..." />
      </div>
      <div class="form-group">
        <label>Amount to Mint</label>
        <input type="number" id="mintAmount" placeholder="0.0" />
      </div>
      <button id="mintBtn" class="action-btn mint">Mint Tokens</button>
    </div>
    
    <!-- Burn Tab -->
    <div id="burn-panel" class="tab-panel">
      <div class="form-group">
        <label>Amount to Burn</label>
        <div class="input-with-max">
          <input type="number" id="burnAmount" placeholder="0.0" />
          <button id="burnMax" class="max-btn">MAX</button>
        </div>
      </div>
      <p class="warning">⚠️ Burned tokens are permanently destroyed</p>
      <button id="burnBtn" class="action-btn burn">Burn Tokens</button>
    </div>
    
    <div id="txResult" class="tx-result" style="display: none;"></div>
    
    <div class="recent-tx">
      <h3>Recent Transactions</h3>
      <div id="txHistory" class="tx-list">
        <div class="empty">No transactions yet</div>
      </div>
    </div>
  </div>
</div>`
  },
  {
    id: 'css',
    name: 'styles.css',
    language: 'css',
    code: `body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
  min-height: 100vh;
  padding: 20px;
  color: white;
}

.app {
  max-width: 500px;
  margin: 0 auto;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.token-logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.header h1 {
  font-size: 28px;
  margin: 0;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #94a3b8;
  margin: 4px 0 0;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #f59e0b;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: none;
  border-radius: 10px;
  color: #94a3b8;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(0, 0, 0, 0.5);
  color: white;
}

.tab.active {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: white;
}

.tab-panel {
  display: none;
}

.tab-panel.active {
  display: block;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: #e2e8f0;
}

.form-group input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: white;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #f59e0b;
}

.input-with-max {
  display: flex;
  gap: 8px;
}

.input-with-max input {
  flex: 1;
}

.max-btn {
  padding: 14px 20px;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  border-radius: 12px;
  color: #f59e0b;
  font-weight: 600;
  cursor: pointer;
}

.max-btn:hover {
  background: rgba(245, 158, 11, 0.3);
}

.action-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.action-btn.mint {
  background: linear-gradient(135deg, #10b981, #059669);
}

.action-btn.mint:hover {
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.action-btn.burn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.action-btn.burn:hover {
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.4);
}

.warning {
  font-size: 13px;
  color: #fbbf24;
  margin-bottom: 16px;
}

.tx-result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.tx-result.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.tx-result.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.recent-tx {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.recent-tx h3 {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 12px;
}

.tx-list {
  max-height: 150px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.tx-type {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.tx-type.transfer { background: #3b82f6; }
.tx-type.mint { background: #10b981; }
.tx-type.burn { background: #ef4444; }

.tx-amount {
  font-weight: 600;
}

.empty {
  text-align: center;
  color: #64748b;
  padding: 20px;
}`
  },
  {
    id: 'javascript',
    name: 'app.js',
    language: 'javascript',
    code: `// ERC20 Token Frontend
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
const txResult = document.getElementById('txResult');
const txHistory = document.getElementById('txHistory');

// State
let balance = 1000000;
let totalSupply = 1000000;
const transactions = [];

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
  });
});

// Update UI
function updateUI() {
  document.getElementById('yourBalance').textContent = balance.toLocaleString();
  document.getElementById('totalSupply').textContent = totalSupply.toLocaleString();
}

// Show result
function showResult(message, type) {
  txResult.textContent = message;
  txResult.className = 'tx-result ' + type;
  txResult.style.display = 'block';
  setTimeout(() => txResult.style.display = 'none', 5000);
}

// Add transaction to history
function addTransaction(type, amount, to) {
  transactions.unshift({ type, amount, to, time: new Date() });
  updateTxHistory();
}

function updateTxHistory() {
  if (transactions.length === 0) {
    txHistory.innerHTML = '<div class="empty">No transactions yet</div>';
    return;
  }
  
  txHistory.innerHTML = transactions.slice(0, 5).map(tx => \`
    <div class="tx-item">
      <span class="tx-type \${tx.type}">\${tx.type.toUpperCase()}</span>
      <span class="tx-amount">\${tx.amount.toLocaleString()} MTK</span>
      <span class="tx-time">\${tx.time.toLocaleTimeString()}</span>
    </div>
  \`).join('');
}

// Transfer
document.getElementById('transferBtn').addEventListener('click', async () => {
  const to = document.getElementById('transferTo').value;
  const amount = parseFloat(document.getElementById('transferAmount').value);
  
  if (!to || !amount) {
    showResult('Please fill all fields', 'error');
    return;
  }
  
  if (amount > balance) {
    showResult('Insufficient balance', 'error');
    return;
  }
  
  // Simulate transaction
  await new Promise(r => setTimeout(r, 1000));
  
  balance -= amount;
  addTransaction('transfer', amount, to);
  updateUI();
  showResult('✅ Transferred ' + amount.toLocaleString() + ' MTK', 'success');
  
  document.getElementById('transferTo').value = '';
  document.getElementById('transferAmount').value = '';
  
  console.log('Transfer:', amount, 'MTK to', to);
});

// Mint
document.getElementById('mintBtn').addEventListener('click', async () => {
  const to = document.getElementById('mintTo').value;
  const amount = parseFloat(document.getElementById('mintAmount').value);
  
  if (!to || !amount) {
    showResult('Please fill all fields', 'error');
    return;
  }
  
  if (!window.IS_DEPLOYED) {
    showResult('Deploy contract first', 'error');
    return;
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  totalSupply += amount;
  if (to === '0x...self') balance += amount;
  
  addTransaction('mint', amount, to);
  updateUI();
  showResult('✅ Minted ' + amount.toLocaleString() + ' MTK', 'success');
  
  document.getElementById('mintTo').value = '';
  document.getElementById('mintAmount').value = '';
  
  console.log('Mint:', amount, 'MTK to', to);
});

// Burn
document.getElementById('burnBtn').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('burnAmount').value);
  
  if (!amount) {
    showResult('Please enter amount', 'error');
    return;
  }
  
  if (amount > balance) {
    showResult('Insufficient balance', 'error');
    return;
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  balance -= amount;
  totalSupply -= amount;
  
  addTransaction('burn', amount, 'burned');
  updateUI();
  showResult('🔥 Burned ' + amount.toLocaleString() + ' MTK', 'success');
  
  document.getElementById('burnAmount').value = '';
  
  console.log('Burn:', amount, 'MTK');
});

// Max buttons
document.getElementById('transferMax').addEventListener('click', () => {
  document.getElementById('transferAmount').value = balance;
});

document.getElementById('burnMax').addEventListener('click', () => {
  document.getElementById('burnAmount').value = balance;
});

// Initialize
updateUI();
console.log('ERC20 Token dApp initialized');`
  }
];

const contractFunctions = [
  {
    name: 'transfer',
    type: 'write' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'mint',
    type: 'write' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'burn',
    type: 'write' as const,
    inputs: [{ name: 'amount', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'read' as const,
    inputs: [{ name: 'account', type: 'address' }],
    outputs: ['uint256']
  },
  {
    name: 'totalSupply',
    type: 'read' as const,
    inputs: [],
    outputs: ['uint256']
  }
];

export default function ERC20TokenFullStack() {
  return (
    <FullStackPlayground
      title="ERC-20 Token"
      description="Fungible token with transfer, mint, and burn functionality"
      difficulty="Beginner"
      files={files}
      contractFunctions={contractFunctions}
      initialState={{ totalSupply: 1000000, balance: 1000000 }}
    />
  );
}
