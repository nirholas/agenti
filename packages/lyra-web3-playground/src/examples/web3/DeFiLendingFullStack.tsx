/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Crafting digital magic since day one ✨
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'LendingPool.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendingPool
 * @dev A DeFi lending protocol similar to Aave/Compound
 * @notice Deposit assets to earn interest, borrow against collateral
 */
contract LendingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    struct Market {
        IERC20 token;
        uint256 totalDeposits;
        uint256 totalBorrows;
        uint256 depositAPY;      // basis points (100 = 1%)
        uint256 borrowAPY;       // basis points
        uint256 collateralFactor; // basis points (8000 = 80%)
        bool isActive;
    }
    
    struct UserPosition {
        uint256 deposited;
        uint256 borrowed;
        uint256 depositTimestamp;
        uint256 borrowTimestamp;
    }
    
    mapping(address => Market) public markets;
    mapping(address => mapping(address => UserPosition)) public positions; // user => token => position
    
    address[] public supportedTokens;
    
    uint256 public constant LIQUIDATION_THRESHOLD = 8500; // 85%
    uint256 public constant LIQUIDATION_BONUS = 500;      // 5%
    
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);
    event Liquidate(address indexed liquidator, address indexed user, uint256 amount);
    
    constructor() Ownable(msg.sender) {}
    
    function addMarket(
        address token,
        uint256 depositAPY,
        uint256 borrowAPY,
        uint256 collateralFactor
    ) external onlyOwner {
        require(address(markets[token].token) == address(0), "Market exists");
        
        markets[token] = Market({
            token: IERC20(token),
            totalDeposits: 0,
            totalBorrows: 0,
            depositAPY: depositAPY,
            borrowAPY: borrowAPY,
            collateralFactor: collateralFactor,
            isActive: true
        });
        
        supportedTokens.push(token);
    }
    
    function deposit(address token, uint256 amount) external nonReentrant {
        Market storage market = markets[token];
        require(market.isActive, "Market not active");
        require(amount > 0, "Amount must be > 0");
        
        market.token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Accrue interest before updating
        _accrueInterest(msg.sender, token);
        
        positions[msg.sender][token].deposited += amount;
        positions[msg.sender][token].depositTimestamp = block.timestamp;
        market.totalDeposits += amount;
        
        emit Deposit(msg.sender, token, amount);
    }
    
    function withdraw(address token, uint256 amount) external nonReentrant {
        Market storage market = markets[token];
        UserPosition storage position = positions[msg.sender][token];
        
        _accrueInterest(msg.sender, token);
        
        require(position.deposited >= amount, "Insufficient balance");
        
        // Check health factor after withdrawal
        position.deposited -= amount;
        require(_healthFactor(msg.sender) >= 10000, "Would be undercollateralized");
        
        market.totalDeposits -= amount;
        market.token.safeTransfer(msg.sender, amount);
        
        emit Withdraw(msg.sender, token, amount);
    }
    
    function borrow(address token, uint256 amount) external nonReentrant {
        Market storage market = markets[token];
        require(market.isActive, "Market not active");
        require(amount <= market.totalDeposits - market.totalBorrows, "Insufficient liquidity");
        
        _accrueInterest(msg.sender, token);
        
        positions[msg.sender][token].borrowed += amount;
        positions[msg.sender][token].borrowTimestamp = block.timestamp;
        market.totalBorrows += amount;
        
        require(_healthFactor(msg.sender) >= 10000, "Undercollateralized");
        
        market.token.safeTransfer(msg.sender, amount);
        
        emit Borrow(msg.sender, token, amount);
    }
    
    function repay(address token, uint256 amount) external nonReentrant {
        Market storage market = markets[token];
        UserPosition storage position = positions[msg.sender][token];
        
        _accrueInterest(msg.sender, token);
        
        uint256 repayAmount = amount > position.borrowed ? position.borrowed : amount;
        
        market.token.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        position.borrowed -= repayAmount;
        market.totalBorrows -= repayAmount;
        
        emit Repay(msg.sender, token, repayAmount);
    }
    
    function _accrueInterest(address user, address token) internal {
        UserPosition storage position = positions[user][token];
        Market storage market = markets[token];
        
        // Accrue deposit interest
        if (position.deposited > 0 && position.depositTimestamp > 0) {
            uint256 timeElapsed = block.timestamp - position.depositTimestamp;
            uint256 interest = (position.deposited * market.depositAPY * timeElapsed) / (10000 * 365 days);
            position.deposited += interest;
            position.depositTimestamp = block.timestamp;
        }
        
        // Accrue borrow interest
        if (position.borrowed > 0 && position.borrowTimestamp > 0) {
            uint256 timeElapsed = block.timestamp - position.borrowTimestamp;
            uint256 interest = (position.borrowed * market.borrowAPY * timeElapsed) / (10000 * 365 days);
            position.borrowed += interest;
            position.borrowTimestamp = block.timestamp;
        }
    }
    
    function _healthFactor(address user) internal view returns (uint256) {
        uint256 totalCollateral = 0;
        uint256 totalBorrowed = 0;
        
        for (uint i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            UserPosition memory pos = positions[user][token];
            Market memory market = markets[token];
            
            totalCollateral += (pos.deposited * market.collateralFactor) / 10000;
            totalBorrowed += pos.borrowed;
        }
        
        if (totalBorrowed == 0) return type(uint256).max;
        return (totalCollateral * 10000) / totalBorrowed;
    }
    
    function getHealthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }
    
    function getUserPosition(address user, address token) external view returns (uint256 deposited, uint256 borrowed) {
        UserPosition memory pos = positions[user][token];
        return (pos.deposited, pos.borrowed);
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
      <h1>🏦 DeFi Lending</h1>
      <p>Deposit to earn interest • Borrow against collateral</p>
    </div>
    
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-label">Total Supplied</span>
        <span id="totalSupplied" class="stat-value">$0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Total Borrowed</span>
        <span id="totalBorrowed" class="stat-value">$0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Health Factor</span>
        <span id="healthFactor" class="stat-value health-good">∞</span>
      </div>
      <div class="stat">
        <span class="stat-label">Net APY</span>
        <span id="netApy" class="stat-value">0%</span>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="switchTab('supply')">Supply</button>
      <button class="tab" onclick="switchTab('borrow')">Borrow</button>
      <button class="tab" onclick="switchTab('positions')">My Positions</button>
    </div>
    
    <div id="supplyTab" class="tab-content active">
      <h2>Available Markets</h2>
      <div id="supplyMarkets" class="markets-grid"></div>
    </div>
    
    <div id="borrowTab" class="tab-content">
      <h2>Borrow Assets</h2>
      <div id="borrowMarkets" class="markets-grid"></div>
    </div>
    
    <div id="positionsTab" class="tab-content">
      <h2>Your Positions</h2>
      <div id="positionsList" class="positions-container"></div>
    </div>
  </div>
</div>

<!-- Action Modal -->
<div id="actionModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">Action</h3>
      <button onclick="closeModal()" class="close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="asset-display">
        <span id="assetIcon" class="asset-icon">🪙</span>
        <span id="assetName" class="asset-name">Token</span>
      </div>
      <div class="form-group">
        <label id="amountLabel">Amount</label>
        <div class="input-row">
          <input type="number" id="actionAmount" placeholder="0.00" />
          <button onclick="setMax()" class="max-btn">MAX</button>
        </div>
        <div id="balanceInfo" class="balance-info"></div>
      </div>
      <div id="actionPreview" class="action-preview"></div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
      <button id="confirmBtn" onclick="confirmAction()" class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>`
  },
  {
    id: 'css',
    name: 'styles.css',
    language: 'css',
    code: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
  min-height: 100vh;
  color: #ffffff;
}

.app {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 32px;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #818cf8, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #94a3b8;
  font-size: 1.1rem;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
}

.health-good { color: #10b981; }
.health-warning { color: #f59e0b; }
.health-danger { color: #ef4444; }

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px;
  border-radius: 12px;
}

.tab {
  flex: 1;
  padding: 12px 24px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

.tab-content h2 {
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: #e2e8f0;
}

.markets-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.market-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 120px;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s;
}

.market-row:hover {
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.08);
}

.asset-col {
  display: flex;
  align-items: center;
  gap: 12px;
}

.asset-icon {
  font-size: 2rem;
}

.asset-info {
  display: flex;
  flex-direction: column;
}

.asset-name {
  font-weight: 600;
  font-size: 1rem;
}

.asset-symbol {
  color: #94a3b8;
  font-size: 0.85rem;
}

.market-stat {
  text-align: right;
}

.market-stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.market-stat-value {
  font-weight: 600;
  color: #fff;
}

.apy-value {
  color: #10b981;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.positions-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.position-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px;
}

.position-section h3 {
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.position-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 80px 80px;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 12px;
}

.modal-footer .btn {
  flex: 1;
}

.asset-display {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.asset-display .asset-icon {
  font-size: 2.5rem;
}

.asset-display .asset-name {
  font-size: 1.25rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #94a3b8;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  color: white;
  font-size: 1.2rem;
}

.max-btn {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
}

.balance-info {
  margin-top: 8px;
  font-size: 0.85rem;
  color: #94a3b8;
}

.action-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 16px;
  font-size: 0.9rem;
}

.action-preview p {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #94a3b8;
}

.action-preview p:last-child {
  margin-bottom: 0;
}

.action-preview strong {
  color: white;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
}`
  },
  {
    id: 'js',
    name: 'app.js',
    language: 'javascript',
    code: `// DeFi Lending Protocol Application

const state = {
  wallet: {
    ETH: 10,
    USDC: 5000,
    WBTC: 0.5,
    DAI: 2000
  },
  markets: [
    { symbol: 'ETH', name: 'Ethereum', icon: '⟠', price: 2000, depositApy: 3.2, borrowApy: 5.8, collateralFactor: 80, totalSupply: 15000000, totalBorrow: 8000000 },
    { symbol: 'USDC', name: 'USD Coin', icon: '💵', price: 1, depositApy: 4.5, borrowApy: 7.2, collateralFactor: 85, totalSupply: 50000000, totalBorrow: 35000000 },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿', price: 43000, depositApy: 1.8, borrowApy: 4.5, collateralFactor: 75, totalSupply: 800, totalBorrow: 400 },
    { symbol: 'DAI', name: 'Dai Stablecoin', icon: '◈', price: 1, depositApy: 5.1, borrowApy: 8.0, collateralFactor: 80, totalSupply: 25000000, totalBorrow: 18000000 }
  ],
  positions: {
    supplied: [],
    borrowed: []
  },
  currentAction: null
};

// Format currency
function formatCurrency(value) {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return '$' + (value / 1000).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

// Calculate health factor
function calculateHealthFactor() {
  const supplied = state.positions.supplied.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price * (market.collateralFactor / 100));
  }, 0);
  
  const borrowed = state.positions.borrowed.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price);
  }, 0);
  
  if (borrowed === 0) return Infinity;
  return supplied / borrowed;
}

// Get borrowing power
function getBorrowingPower() {
  const collateral = state.positions.supplied.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price * (market.collateralFactor / 100));
  }, 0);
  
  const borrowed = state.positions.borrowed.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price);
  }, 0);
  
  return Math.max(0, collateral - borrowed);
}

// Update stats
function updateStats() {
  const totalSupplied = state.positions.supplied.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price);
  }, 0);
  
  const totalBorrowed = state.positions.borrowed.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price);
  }, 0);
  
  const healthFactor = calculateHealthFactor();
  
  document.getElementById('totalSupplied').textContent = formatCurrency(totalSupplied);
  document.getElementById('totalBorrowed').textContent = formatCurrency(totalBorrowed);
  
  const hfElement = document.getElementById('healthFactor');
  if (healthFactor === Infinity) {
    hfElement.textContent = '∞';
    hfElement.className = 'stat-value health-good';
  } else {
    hfElement.textContent = healthFactor.toFixed(2);
    hfElement.className = 'stat-value ' + 
      (healthFactor >= 1.5 ? 'health-good' : healthFactor >= 1.1 ? 'health-warning' : 'health-danger');
  }
  
  // Calculate net APY
  const supplyApy = state.positions.supplied.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price * market.depositApy / 100);
  }, 0);
  
  const borrowApy = state.positions.borrowed.reduce((sum, pos) => {
    const market = state.markets.find(m => m.symbol === pos.symbol);
    return sum + (pos.amount * market.price * market.borrowApy / 100);
  }, 0);
  
  const netApy = totalSupplied > 0 ? ((supplyApy - borrowApy) / totalSupplied * 100) : 0;
  document.getElementById('netApy').textContent = netApy.toFixed(2) + '%';
}

// Render supply markets
function renderSupplyMarkets() {
  const container = document.getElementById('supplyMarkets');
  container.innerHTML = state.markets.map(market => \`
    <div class="market-row">
      <div class="asset-col">
        <span class="asset-icon">\${market.icon}</span>
        <div class="asset-info">
          <span class="asset-name">\${market.name}</span>
          <span class="asset-symbol">\${market.symbol}</span>
        </div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Deposit APY</div>
        <div class="market-stat-value apy-value">\${market.depositApy}%</div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Total Supply</div>
        <div class="market-stat-value">\${formatCurrency(market.totalSupply * market.price)}</div>
      </div>
      <div class="market-stat">
        <div class="market-stat-label">Wallet</div>
        <div class="market-stat-value">\${state.wallet[market.symbol] || 0} \${market.symbol}</div>
      </div>
      <button class="btn btn-primary" onclick="openModal('supply', '\${market.symbol}')">
        Supply
      </button>
    </div>
  \`).join('');
}

// Render borrow markets
function renderBorrowMarkets() {
  const container = document.getElementById('borrowMarkets');
  const borrowPower = getBorrowingPower();
  
  container.innerHTML = state.markets.map(market => {
    const maxBorrow = borrowPower / market.price;
    return \`
      <div class="market-row">
        <div class="asset-col">
          <span class="asset-icon">\${market.icon}</span>
          <div class="asset-info">
            <span class="asset-name">\${market.name}</span>
            <span class="asset-symbol">\${market.symbol}</span>
          </div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Borrow APY</div>
          <div class="market-stat-value" style="color: #f59e0b">\${market.borrowApy}%</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Liquidity</div>
          <div class="market-stat-value">\${formatCurrency((market.totalSupply - market.totalBorrow) * market.price)}</div>
        </div>
        <div class="market-stat">
          <div class="market-stat-label">Max Borrow</div>
          <div class="market-stat-value">\${maxBorrow.toFixed(4)} \${market.symbol}</div>
        </div>
        <button class="btn btn-primary" onclick="openModal('borrow', '\${market.symbol}')" \${borrowPower <= 0 ? 'disabled style="opacity:0.5"' : ''}>
          Borrow
        </button>
      </div>
    \`;
  }).join('');
}

// Render positions
function renderPositions() {
  const container = document.getElementById('positionsList');
  
  let html = '';
  
  if (state.positions.supplied.length > 0) {
    html += \`<div class="position-section"><h3>Supplied Assets</h3>\`;
    html += state.positions.supplied.map((pos, idx) => {
      const market = state.markets.find(m => m.symbol === pos.symbol);
      return \`
        <div class="position-item">
          <div class="asset-col">
            <span class="asset-icon">\${market.icon}</span>
            <span>\${pos.amount.toFixed(4)} \${pos.symbol}</span>
          </div>
          <div>\${formatCurrency(pos.amount * market.price)}</div>
          <div style="color: #10b981">+\${market.depositApy}% APY</div>
          <button class="btn btn-secondary" onclick="openModal('withdraw', '\${pos.symbol}')">Withdraw</button>
          <button class="btn btn-primary" onclick="openModal('supply', '\${pos.symbol}')">Add</button>
        </div>
      \`;
    }).join('');
    html += \`</div>\`;
  }
  
  if (state.positions.borrowed.length > 0) {
    html += \`<div class="position-section"><h3>Borrowed Assets</h3>\`;
    html += state.positions.borrowed.map((pos, idx) => {
      const market = state.markets.find(m => m.symbol === pos.symbol);
      return \`
        <div class="position-item">
          <div class="asset-col">
            <span class="asset-icon">\${market.icon}</span>
            <span>\${pos.amount.toFixed(4)} \${pos.symbol}</span>
          </div>
          <div>\${formatCurrency(pos.amount * market.price)}</div>
          <div style="color: #f59e0b">-\${market.borrowApy}% APY</div>
          <button class="btn btn-primary" onclick="openModal('repay', '\${pos.symbol}')">Repay</button>
          <button class="btn btn-secondary" onclick="openModal('borrow', '\${pos.symbol}')">More</button>
        </div>
      \`;
    }).join('');
    html += \`</div>\`;
  }
  
  if (!html) {
    html = '<div class="empty-state">No active positions. Supply assets to start earning!</div>';
  }
  
  container.innerHTML = html;
}

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  document.querySelector(\`.tab:nth-child(\${tab === 'supply' ? 1 : tab === 'borrow' ? 2 : 3})\`).classList.add('active');
  document.getElementById(tab + 'Tab').classList.add('active');
}

// Modal functions
function openModal(action, symbol) {
  const market = state.markets.find(m => m.symbol === symbol);
  state.currentAction = { action, symbol, market };
  
  const titles = { supply: 'Supply', withdraw: 'Withdraw', borrow: 'Borrow', repay: 'Repay' };
  document.getElementById('modalTitle').textContent = titles[action] + ' ' + symbol;
  document.getElementById('assetIcon').textContent = market.icon;
  document.getElementById('assetName').textContent = market.name;
  document.getElementById('actionAmount').value = '';
  
  let balanceText = '';
  if (action === 'supply') balanceText = \`Wallet: \${state.wallet[symbol] || 0} \${symbol}\`;
  else if (action === 'withdraw') balanceText = \`Supplied: \${state.positions.supplied.find(p => p.symbol === symbol)?.amount || 0} \${symbol}\`;
  else if (action === 'borrow') balanceText = \`Available: \${(getBorrowingPower() / market.price).toFixed(4)} \${symbol}\`;
  else if (action === 'repay') balanceText = \`Owed: \${state.positions.borrowed.find(p => p.symbol === symbol)?.amount || 0} \${symbol}\`;
  
  document.getElementById('balanceInfo').textContent = balanceText;
  document.getElementById('actionModal').style.display = 'flex';
  
  console.log(\`[UI] Opened \${action} modal for \${symbol}\`);
}

function closeModal() {
  document.getElementById('actionModal').style.display = 'none';
  state.currentAction = null;
}

function setMax() {
  const { action, symbol, market } = state.currentAction;
  let max = 0;
  
  if (action === 'supply') max = state.wallet[symbol] || 0;
  else if (action === 'withdraw') max = state.positions.supplied.find(p => p.symbol === symbol)?.amount || 0;
  else if (action === 'borrow') max = getBorrowingPower() / market.price;
  else if (action === 'repay') max = Math.min(state.wallet[symbol] || 0, state.positions.borrowed.find(p => p.symbol === symbol)?.amount || 0);
  
  document.getElementById('actionAmount').value = max.toFixed(6);
}

function confirmAction() {
  const { action, symbol, market } = state.currentAction;
  const amount = parseFloat(document.getElementById('actionAmount').value);
  
  if (!amount || amount <= 0) {
    console.error('[ERROR] Invalid amount');
    return;
  }
  
  if (action === 'supply') {
    if (amount > (state.wallet[symbol] || 0)) {
      console.error('[ERROR] Insufficient balance');
      return;
    }
    state.wallet[symbol] -= amount;
    const existing = state.positions.supplied.find(p => p.symbol === symbol);
    if (existing) existing.amount += amount;
    else state.positions.supplied.push({ symbol, amount });
    console.log(\`[TX] Supplied \${amount} \${symbol}\`);
    console.log(\`[CONTRACT] LendingPool.deposit(\${symbol}, \${amount})\`);
  }
  else if (action === 'withdraw') {
    const pos = state.positions.supplied.find(p => p.symbol === symbol);
    if (!pos || amount > pos.amount) {
      console.error('[ERROR] Insufficient supplied balance');
      return;
    }
    pos.amount -= amount;
    if (pos.amount === 0) state.positions.supplied = state.positions.supplied.filter(p => p.symbol !== symbol);
    state.wallet[symbol] = (state.wallet[symbol] || 0) + amount;
    console.log(\`[TX] Withdrew \${amount} \${symbol}\`);
    console.log(\`[CONTRACT] LendingPool.withdraw(\${symbol}, \${amount})\`);
  }
  else if (action === 'borrow') {
    if (amount * market.price > getBorrowingPower()) {
      console.error('[ERROR] Exceeds borrowing power');
      return;
    }
    const existing = state.positions.borrowed.find(p => p.symbol === symbol);
    if (existing) existing.amount += amount;
    else state.positions.borrowed.push({ symbol, amount });
    state.wallet[symbol] = (state.wallet[symbol] || 0) + amount;
    console.log(\`[TX] Borrowed \${amount} \${symbol}\`);
    console.log(\`[CONTRACT] LendingPool.borrow(\${symbol}, \${amount})\`);
  }
  else if (action === 'repay') {
    const pos = state.positions.borrowed.find(p => p.symbol === symbol);
    const repayAmount = Math.min(amount, pos?.amount || 0);
    if (!pos || (state.wallet[symbol] || 0) < repayAmount) {
      console.error('[ERROR] Cannot repay');
      return;
    }
    pos.amount -= repayAmount;
    if (pos.amount === 0) state.positions.borrowed = state.positions.borrowed.filter(p => p.symbol !== symbol);
    state.wallet[symbol] -= repayAmount;
    console.log(\`[TX] Repaid \${repayAmount} \${symbol}\`);
    console.log(\`[CONTRACT] LendingPool.repay(\${symbol}, \${repayAmount})\`);
  }
  
  closeModal();
  renderAll();
}

function renderAll() {
  renderSupplyMarkets();
  renderBorrowMarkets();
  renderPositions();
  updateStats();
}

// Initialize
renderAll();
console.log('[INIT] DeFi Lending Protocol initialized');
console.log('[INFO] 4 markets available: ETH, USDC, WBTC, DAI');`
  }
];

const contractFunctions = [
  {
    name: 'deposit',
    type: 'write' as const,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'withdraw',
    type: 'write' as const,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'borrow',
    type: 'write' as const,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'repay',
    type: 'write' as const,
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'getHealthFactor',
    type: 'read' as const,
    inputs: [
      { name: 'user', type: 'address' }
    ]
  },
  {
    name: 'getUserPosition',
    type: 'read' as const,
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' }
    ]
  }
];

export default function DeFiLendingFullStack() {
  return (
    <FullStackPlayground
      difficulty="Advanced"
      files={files}
      contractFunctions={contractFunctions}
      title="DeFi Lending Protocol"
      description="Deposit assets to earn interest and borrow against your collateral like Aave or Compound"
    />
  );
}
