/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Crafting digital magic since day one ✨
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'TokenSwap.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title SimpleSwap - AMM-style token swap
/// @notice Constant product market maker (x * y = k)
contract SimpleSwap is ReentrancyGuard {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;
    
    uint256 public constant FEE_PERCENT = 3; // 0.3% fee
    
    event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);
    event AddLiquidity(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event RemoveLiquidity(address indexed provider, uint256 amountA, uint256 amountB);
    
    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }
    
    /// @notice Add liquidity to the pool
    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant returns (uint256) {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        
        uint256 liquidityMinted;
        if (totalLiquidity == 0) {
            liquidityMinted = sqrt(amountA * amountB);
        } else {
            liquidityMinted = min(
                (amountA * totalLiquidity) / reserveA,
                (amountB * totalLiquidity) / reserveB
            );
        }
        
        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
        reserveA += amountA;
        reserveB += amountB;
        
        emit AddLiquidity(msg.sender, amountA, amountB, liquidityMinted);
        return liquidityMinted;
    }
    
    /// @notice Swap tokenA for tokenB
    function swapAForB(uint256 amountIn) external nonReentrant returns (uint256) {
        require(amountIn > 0, "Amount must be > 0");
        
        uint256 amountInWithFee = amountIn * (1000 - FEE_PERCENT);
        uint256 amountOut = (amountInWithFee * reserveB) / (reserveA * 1000 + amountInWithFee);
        
        tokenA.transferFrom(msg.sender, address(this), amountIn);
        tokenB.transfer(msg.sender, amountOut);
        
        reserveA += amountIn;
        reserveB -= amountOut;
        
        emit Swap(msg.sender, address(tokenA), amountIn, amountOut);
        return amountOut;
    }
    
    /// @notice Swap tokenB for tokenA
    function swapBForA(uint256 amountIn) external nonReentrant returns (uint256) {
        require(amountIn > 0, "Amount must be > 0");
        
        uint256 amountInWithFee = amountIn * (1000 - FEE_PERCENT);
        uint256 amountOut = (amountInWithFee * reserveA) / (reserveB * 1000 + amountInWithFee);
        
        tokenB.transferFrom(msg.sender, address(this), amountIn);
        tokenA.transfer(msg.sender, amountOut);
        
        reserveB += amountIn;
        reserveA -= amountOut;
        
        emit Swap(msg.sender, address(tokenB), amountIn, amountOut);
        return amountOut;
    }
    
    /// @notice Get quote for swap
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        uint256 amountInWithFee = amountIn * (1000 - FEE_PERCENT);
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }
    
    function sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
        return y;
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}`
  },
  {
    id: 'html',
    name: 'index.html',
    language: 'html',
    code: `<div class="app">
  <div class="swap-card">
    <div class="header">
      <h1>🔄 Token Swap</h1>
      <p>Decentralized Exchange Demo</p>
    </div>
    
    <div class="pool-stats">
      <div class="stat">
        <span class="label">Pool Liquidity</span>
        <span id="poolLiquidity" class="value">$0</span>
      </div>
      <div class="stat">
        <span class="label">24h Volume</span>
        <span id="volume" class="value">$0</span>
      </div>
    </div>
    
    <div class="swap-interface">
      <!-- From Token -->
      <div class="token-box">
        <div class="token-header">
          <span class="label">From</span>
          <span class="balance">Balance: <span id="fromBalance">0</span></span>
        </div>
        <div class="token-input">
          <input type="number" id="fromAmount" placeholder="0.0" />
          <button id="fromToken" class="token-select">
            <span class="token-icon">Ξ</span>
            <span id="fromSymbol">ETH</span>
            <span class="arrow">▼</span>
          </button>
        </div>
      </div>
      
      <!-- Swap Direction -->
      <button id="swapDirection" class="swap-arrow">
        ⬇️
      </button>
      
      <!-- To Token -->
      <div class="token-box">
        <div class="token-header">
          <span class="label">To (estimated)</span>
          <span class="balance">Balance: <span id="toBalance">0</span></span>
        </div>
        <div class="token-input">
          <input type="number" id="toAmount" placeholder="0.0" readonly />
          <button id="toToken" class="token-select">
            <span class="token-icon">🪙</span>
            <span id="toSymbol">USDC</span>
            <span class="arrow">▼</span>
          </button>
        </div>
      </div>
      
      <!-- Price Info -->
      <div class="price-info">
        <div class="info-row">
          <span>Rate</span>
          <span id="rate">1 ETH = 2,000 USDC</span>
        </div>
        <div class="info-row">
          <span>Price Impact</span>
          <span id="priceImpact" class="low">< 0.01%</span>
        </div>
        <div class="info-row">
          <span>Network Fee</span>
          <span id="networkFee">~$2.50</span>
        </div>
      </div>
      
      <!-- Swap Button -->
      <button id="swapBtn" class="swap-btn">
        Enter an amount
      </button>
    </div>
    
    <div id="txHistory" class="tx-history">
      <h3>Recent Swaps</h3>
      <div id="txList" class="tx-list">
        <div class="empty">No swaps yet</div>
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
  background: linear-gradient(180deg, #191b1f 0%, #1f2128 100%);
  min-height: 100vh;
  padding: 20px;
  color: white;
}

.app {
  max-width: 480px;
  margin: 0 auto;
}

.swap-card {
  background: #212429;
  border-radius: 24px;
  padding: 16px;
  border: 1px solid #2c2f36;
}

.header {
  text-align: center;
  padding: 16px 0;
}

.header h1 {
  font-size: 24px;
  margin: 0 0 4px;
  background: linear-gradient(135deg, #fc72ff, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #8b8d93;
  font-size: 14px;
  margin: 0;
}

.pool-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pool-stats .stat {
  flex: 1;
  background: #191b1f;
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.pool-stats .label {
  display: block;
  font-size: 12px;
  color: #8b8d93;
  margin-bottom: 4px;
}

.pool-stats .value {
  font-size: 18px;
  font-weight: 600;
  color: #fc72ff;
}

.token-box {
  background: #191b1f;
  border-radius: 16px;
  padding: 16px;
}

.token-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.token-header .label {
  font-size: 14px;
  color: #8b8d93;
}

.token-header .balance {
  font-size: 14px;
  color: #8b8d93;
}

.token-input {
  display: flex;
  gap: 8px;
}

.token-input input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 28px;
  font-weight: 500;
  color: white;
  outline: none;
  min-width: 0;
}

.token-input input::placeholder {
  color: #5d6168;
}

.token-select {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2c2f36;
  border: none;
  border-radius: 16px;
  padding: 8px 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.token-select:hover {
  background: #3c3f46;
}

.token-icon {
  font-size: 20px;
}

.arrow {
  font-size: 10px;
  color: #8b8d93;
}

.swap-arrow {
  display: block;
  margin: -8px auto;
  width: 40px;
  height: 40px;
  background: #212429;
  border: 4px solid #191b1f;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  z-index: 1;
  position: relative;
}

.swap-arrow:hover {
  background: #2c2f36;
}

.price-info {
  margin-top: 16px;
  padding: 16px;
  background: #191b1f;
  border-radius: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #8b8d93;
  padding: 4px 0;
}

.info-row .low {
  color: #27ae60;
}

.swap-btn {
  width: 100%;
  padding: 18px;
  margin-top: 16px;
  background: linear-gradient(135deg, #fc72ff, #8b5cf6);
  border: none;
  border-radius: 16px;
  color: white;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.swap-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.swap-btn:disabled {
  background: #2c2f36;
  color: #5d6168;
  cursor: not-allowed;
}

.tx-history {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #2c2f36;
}

.tx-history h3 {
  font-size: 14px;
  color: #8b8d93;
  margin: 0 0 12px;
}

.tx-list {
  max-height: 150px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #191b1f;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.tx-item .from-to {
  color: white;
}

.tx-item .time {
  color: #8b8d93;
}

.empty {
  text-align: center;
  color: #5d6168;
  padding: 20px;
  font-size: 14px;
}`
  },
  {
    id: 'javascript',
    name: 'app.js',
    language: 'javascript',
    code: `// Token Swap DEX - Frontend Logic
const fromAmountInput = document.getElementById('fromAmount');
const toAmountInput = document.getElementById('toAmount');
const fromSymbol = document.getElementById('fromSymbol');
const toSymbol = document.getElementById('toSymbol');
const fromBalance = document.getElementById('fromBalance');
const toBalance = document.getElementById('toBalance');
const swapBtn = document.getElementById('swapBtn');
const swapDirection = document.getElementById('swapDirection');
const rateEl = document.getElementById('rate');
const priceImpact = document.getElementById('priceImpact');
const poolLiquidity = document.getElementById('poolLiquidity');
const volumeEl = document.getElementById('volume');
const txList = document.getElementById('txList');

// Token data
const tokens = {
  ETH: { symbol: 'ETH', icon: 'Ξ', price: 2000, balance: 1.5 },
  USDC: { symbol: 'USDC', icon: '🪙', price: 1, balance: 3000 },
  DAI: { symbol: 'DAI', icon: '◈', price: 1, balance: 1500 }
};

// Pool reserves (simulated)
let reserves = {
  ETH: 100,
  USDC: 200000
};

let fromToken = 'ETH';
let toToken = 'USDC';
let swaps = [];

// Initialize
function init() {
  updateBalances();
  updatePoolStats();
  
  if (window.IS_DEPLOYED) {
    swapBtn.textContent = 'Enter an amount';
    swapBtn.disabled = true;
  } else {
    swapBtn.textContent = 'Deploy Contract First';
    swapBtn.disabled = true;
  }
}

function updateBalances() {
  fromBalance.textContent = tokens[fromToken].balance.toFixed(4);
  toBalance.textContent = tokens[toToken].balance.toFixed(4);
}

function updatePoolStats() {
  const tvl = reserves.ETH * tokens.ETH.price + reserves.USDC;
  poolLiquidity.textContent = '$' + tvl.toLocaleString();
  volumeEl.textContent = '$' + (Math.random() * 100000).toFixed(0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

// Calculate output amount (constant product formula)
function calculateOutput(amountIn, reserveIn, reserveOut) {
  const fee = 0.003; // 0.3% fee
  const amountInWithFee = amountIn * (1 - fee);
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
}

// Calculate price impact
function calculatePriceImpact(amountIn, reserveIn) {
  return (amountIn / reserveIn) * 100;
}

// Update quote when input changes
fromAmountInput.addEventListener('input', () => {
  const amountIn = parseFloat(fromAmountInput.value) || 0;
  
  if (amountIn <= 0) {
    toAmountInput.value = '';
    swapBtn.textContent = 'Enter an amount';
    swapBtn.disabled = true;
    return;
  }
  
  if (amountIn > tokens[fromToken].balance) {
    swapBtn.textContent = 'Insufficient balance';
    swapBtn.disabled = true;
    return;
  }
  
  const reserveIn = reserves[fromToken] || 100;
  const reserveOut = reserves[toToken] || 200000;
  
  const amountOut = calculateOutput(amountIn, reserveIn, reserveOut);
  toAmountInput.value = amountOut.toFixed(6);
  
  // Update rate
  const rate = amountOut / amountIn;
  rateEl.textContent = '1 ' + fromToken + ' = ' + rate.toFixed(2) + ' ' + toToken;
  
  // Update price impact
  const impact = calculatePriceImpact(amountIn, reserveIn);
  priceImpact.textContent = impact.toFixed(2) + '%';
  priceImpact.className = impact < 1 ? 'low' : impact < 5 ? '' : 'high';
  
  if (window.IS_DEPLOYED) {
    swapBtn.textContent = 'Swap';
    swapBtn.disabled = false;
  }
});

// Swap direction
swapDirection.addEventListener('click', () => {
  [fromToken, toToken] = [toToken, fromToken];
  fromSymbol.textContent = fromToken;
  toSymbol.textContent = toToken;
  fromAmountInput.value = '';
  toAmountInput.value = '';
  updateBalances();
});

// Execute swap
swapBtn.addEventListener('click', async () => {
  const amountIn = parseFloat(fromAmountInput.value);
  const amountOut = parseFloat(toAmountInput.value);
  
  if (!amountIn || !amountOut) return;
  
  swapBtn.textContent = 'Swapping...';
  swapBtn.disabled = true;
  
  // Simulate transaction
  await new Promise(r => setTimeout(r, 1500));
  
  // Update balances
  tokens[fromToken].balance -= amountIn;
  tokens[toToken].balance += amountOut;
  
  // Update reserves
  reserves[fromToken] = (reserves[fromToken] || 100) + amountIn;
  reserves[toToken] = (reserves[toToken] || 200000) - amountOut;
  
  // Add to history
  swaps.unshift({
    from: fromToken,
    to: toToken,
    amountIn: amountIn,
    amountOut: amountOut,
    time: new Date()
  });
  
  updateTxHistory();
  updateBalances();
  updatePoolStats();
  
  // Reset
  fromAmountInput.value = '';
  toAmountInput.value = '';
  swapBtn.textContent = 'Enter an amount';
  
  console.log('Swap executed:', amountIn, fromToken, '->', amountOut.toFixed(4), toToken);
});

function updateTxHistory() {
  if (swaps.length === 0) {
    txList.innerHTML = '<div class="empty">No swaps yet</div>';
    return;
  }
  
  txList.innerHTML = swaps.slice(0, 5).map(tx => \`
    <div class="tx-item">
      <span class="from-to">\${tx.amountIn.toFixed(4)} \${tx.from} → \${tx.amountOut.toFixed(4)} \${tx.to}</span>
      <span class="time">\${tx.time.toLocaleTimeString()}</span>
    </div>
  \`).join('');
}

// Initialize
init();
setInterval(() => {
  if (window.IS_DEPLOYED && !fromAmountInput.value) {
    swapBtn.textContent = 'Enter an amount';
  }
}, 1000);

console.log('Token Swap DEX initialized');`
  }
];

const contractFunctions = [
  {
    name: 'swapAForB',
    type: 'write' as const,
    inputs: [{ name: 'amountIn', type: 'uint256' }]
  },
  {
    name: 'swapBForA',
    type: 'write' as const,
    inputs: [{ name: 'amountIn', type: 'uint256' }]
  },
  {
    name: 'addLiquidity',
    type: 'write' as const,
    inputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' }
    ]
  },
  {
    name: 'getAmountOut',
    type: 'read' as const,
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'reserveIn', type: 'uint256' },
      { name: 'reserveOut', type: 'uint256' }
    ],
    outputs: ['uint256']
  }
];

export default function TokenSwapFullStack() {
  return (
    <FullStackPlayground
      title="Token Swap DEX"
      description="Decentralized exchange with AMM (Automated Market Maker) using constant product formula"
      difficulty="Advanced"
      files={files}
      contractFunctions={contractFunctions}
      initialState={{ reserveA: 100, reserveB: 200000 }}
    />
  );
}
