/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Believe in your code, believe in yourself 💪
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'YieldFarm.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldFarm
 * @dev Stake LP tokens to earn reward tokens
 * @notice Farm rewards by providing liquidity
 */
contract YieldFarm is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    struct Farm {
        IERC20 lpToken;           // LP token to stake
        uint256 allocPoint;       // Allocation points for rewards
        uint256 lastRewardTime;   // Last reward distribution time
        uint256 accRewardPerShare; // Accumulated rewards per share
        uint256 totalStaked;      // Total LP tokens staked
    }
    
    struct UserInfo {
        uint256 amount;           // LP tokens staked
        uint256 rewardDebt;       // Reward debt for proper calculation
        uint256 pendingRewards;   // Unclaimed rewards
    }
    
    IERC20 public rewardToken;
    uint256 public rewardPerSecond;
    uint256 public totalAllocPoint;
    
    Farm[] public farms;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    
    event Deposit(address indexed user, uint256 indexed farmId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed farmId, uint256 amount);
    event Harvest(address indexed user, uint256 indexed farmId, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed farmId, uint256 amount);
    
    constructor(address _rewardToken, uint256 _rewardPerSecond) Ownable(msg.sender) {
        rewardToken = IERC20(_rewardToken);
        rewardPerSecond = _rewardPerSecond;
    }
    
    function addFarm(address _lpToken, uint256 _allocPoint) external onlyOwner {
        totalAllocPoint += _allocPoint;
        
        farms.push(Farm({
            lpToken: IERC20(_lpToken),
            allocPoint: _allocPoint,
            lastRewardTime: block.timestamp,
            accRewardPerShare: 0,
            totalStaked: 0
        }));
    }
    
    function updateFarm(uint256 farmId) public {
        Farm storage farm = farms[farmId];
        
        if (block.timestamp <= farm.lastRewardTime) return;
        if (farm.totalStaked == 0) {
            farm.lastRewardTime = block.timestamp;
            return;
        }
        
        uint256 timeElapsed = block.timestamp - farm.lastRewardTime;
        uint256 reward = (timeElapsed * rewardPerSecond * farm.allocPoint) / totalAllocPoint;
        
        farm.accRewardPerShare += (reward * 1e12) / farm.totalStaked;
        farm.lastRewardTime = block.timestamp;
    }
    
    function deposit(uint256 farmId, uint256 amount) external nonReentrant {
        Farm storage farm = farms[farmId];
        UserInfo storage user = userInfo[farmId][msg.sender];
        
        updateFarm(farmId);
        
        // Harvest pending rewards
        if (user.amount > 0) {
            uint256 pending = (user.amount * farm.accRewardPerShare / 1e12) - user.rewardDebt;
            user.pendingRewards += pending;
        }
        
        if (amount > 0) {
            farm.lpToken.safeTransferFrom(msg.sender, address(this), amount);
            user.amount += amount;
            farm.totalStaked += amount;
        }
        
        user.rewardDebt = user.amount * farm.accRewardPerShare / 1e12;
        
        emit Deposit(msg.sender, farmId, amount);
    }
    
    function withdraw(uint256 farmId, uint256 amount) external nonReentrant {
        Farm storage farm = farms[farmId];
        UserInfo storage user = userInfo[farmId][msg.sender];
        
        require(user.amount >= amount, "Insufficient balance");
        
        updateFarm(farmId);
        
        // Calculate pending rewards
        uint256 pending = (user.amount * farm.accRewardPerShare / 1e12) - user.rewardDebt;
        user.pendingRewards += pending;
        
        if (amount > 0) {
            user.amount -= amount;
            farm.totalStaked -= amount;
            farm.lpToken.safeTransfer(msg.sender, amount);
        }
        
        user.rewardDebt = user.amount * farm.accRewardPerShare / 1e12;
        
        emit Withdraw(msg.sender, farmId, amount);
    }
    
    function harvest(uint256 farmId) external nonReentrant {
        Farm storage farm = farms[farmId];
        UserInfo storage user = userInfo[farmId][msg.sender];
        
        updateFarm(farmId);
        
        uint256 pending = (user.amount * farm.accRewardPerShare / 1e12) - user.rewardDebt;
        uint256 totalRewards = user.pendingRewards + pending;
        
        require(totalRewards > 0, "No rewards to harvest");
        
        user.pendingRewards = 0;
        user.rewardDebt = user.amount * farm.accRewardPerShare / 1e12;
        
        rewardToken.safeTransfer(msg.sender, totalRewards);
        
        emit Harvest(msg.sender, farmId, totalRewards);
    }
    
    function pendingReward(uint256 farmId, address _user) external view returns (uint256) {
        Farm memory farm = farms[farmId];
        UserInfo memory user = userInfo[farmId][_user];
        
        uint256 accRewardPerShare = farm.accRewardPerShare;
        
        if (block.timestamp > farm.lastRewardTime && farm.totalStaked > 0) {
            uint256 timeElapsed = block.timestamp - farm.lastRewardTime;
            uint256 reward = (timeElapsed * rewardPerSecond * farm.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / farm.totalStaked;
        }
        
        return user.pendingRewards + (user.amount * accRewardPerShare / 1e12) - user.rewardDebt;
    }
    
    function farmCount() external view returns (uint256) {
        return farms.length;
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
      <h1>🌾 Yield Farming</h1>
      <p>Stake LP tokens to earn FARM rewards</p>
    </div>
    
    <div class="stats-row">
      <div class="stat-box">
        <span class="stat-icon">🏆</span>
        <div class="stat-content">
          <span class="stat-value" id="totalValueLocked">$0</span>
          <span class="stat-label">Total Value Locked</span>
        </div>
      </div>
      <div class="stat-box">
        <span class="stat-icon">💰</span>
        <div class="stat-content">
          <span class="stat-value" id="farmBalance">0 FARM</span>
          <span class="stat-label">Your FARM Balance</span>
        </div>
      </div>
      <div class="stat-box">
        <span class="stat-icon">🎁</span>
        <div class="stat-content">
          <span class="stat-value highlight" id="pendingRewards">0 FARM</span>
          <span class="stat-label">Pending Rewards</span>
        </div>
      </div>
    </div>
    
    <div class="section-header">
      <h2>Active Farms</h2>
      <button class="btn btn-secondary" onclick="harvestAll()">🌾 Harvest All</button>
    </div>
    
    <div id="farmsContainer" class="farms-list"></div>
  </div>
</div>

<!-- Stake Modal -->
<div id="stakeModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">Stake LP</h3>
      <button onclick="closeModal()" class="close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-tabs">
        <button class="modal-tab active" onclick="switchModalTab('stake')">Stake</button>
        <button class="modal-tab" onclick="switchModalTab('unstake')">Unstake</button>
      </div>
      <div class="form-group">
        <div class="label-row">
          <label id="amountLabel">Amount</label>
          <span id="balanceLabel" class="balance-label">Balance: 0</span>
        </div>
        <div class="input-row">
          <input type="number" id="lpAmount" placeholder="0.0" />
          <button onclick="setMaxLP()" class="max-btn">MAX</button>
        </div>
      </div>
      <div id="stakePreview" class="stake-preview"></div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
      <button id="confirmStakeBtn" onclick="confirmStake()" class="btn btn-primary">Stake</button>
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
  background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
  min-height: 100vh;
  color: #ffffff;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.card {
  background: rgba(255, 255, 255, 0.08);
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
  background: linear-gradient(135deg, #34d399, #6ee7b7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #a7f3d0;
  font-size: 1.1rem;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-value.highlight {
  color: #34d399;
}

.stat-label {
  font-size: 0.85rem;
  color: #a7f3d0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 1.25rem;
  color: #ecfdf5;
}

.farms-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.farm-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
}

.farm-card:hover {
  border-color: #34d399;
  transform: translateY(-2px);
}

.farm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.farm-pair {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pair-icons {
  display: flex;
}

.pair-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  border: 2px solid #064e3b;
}

.pair-icon:last-child {
  margin-left: -12px;
}

.pair-info {
  display: flex;
  flex-direction: column;
}

.pair-name {
  font-size: 1.1rem;
  font-weight: 600;
}

.pair-platform {
  font-size: 0.85rem;
  color: #a7f3d0;
}

.farm-apy {
  text-align: right;
}

.apy-label {
  font-size: 0.8rem;
  color: #a7f3d0;
}

.apy-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #34d399;
}

.farm-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.farm-stat {
  text-align: center;
}

.farm-stat-label {
  font-size: 0.75rem;
  color: #a7f3d0;
  margin-bottom: 4px;
}

.farm-stat-value {
  font-size: 1rem;
  font-weight: 600;
}

.farm-actions {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981, #34d399);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.25);
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
  background: #065f46;
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  color: #a7f3d0;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
}

.modal-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 10px;
}

.modal-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: #a7f3d0;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
}

.modal-tab.active {
  background: #10b981;
  color: white;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.label-row label {
  color: #a7f3d0;
}

.balance-label {
  color: #6ee7b7;
  font-size: 0.9rem;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  color: white;
  font-size: 1.2rem;
}

.max-btn {
  background: rgba(16, 185, 129, 0.3);
  color: #34d399;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
}

.stake-preview {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 16px;
  font-size: 0.9rem;
}

.stake-preview p {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #a7f3d0;
}

.stake-preview strong {
  color: white;
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  
  .farm-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}`
  },
  {
    id: 'js',
    name: 'app.js',
    language: 'javascript',
    code: `// Yield Farming Application

const state = {
  farmBalance: 0,
  lpBalances: {
    'ETH-USDC': 10,
    'WBTC-ETH': 2,
    'DAI-USDC': 1000,
    'LINK-ETH': 50
  },
  farms: [
    { id: 0, pair: 'ETH-USDC', icons: ['⟠', '💵'], platform: 'Uniswap V3', apy: 45.2, tvl: 12500000, multiplier: '40x', yourStaked: 0, pendingReward: 0 },
    { id: 1, pair: 'WBTC-ETH', icons: ['₿', '⟠'], platform: 'Uniswap V3', apy: 32.8, tvl: 8700000, multiplier: '30x', yourStaked: 0, pendingReward: 0 },
    { id: 2, pair: 'DAI-USDC', icons: ['◈', '💵'], platform: 'Curve', apy: 18.5, tvl: 25000000, multiplier: '15x', yourStaked: 0, pendingReward: 0 },
    { id: 3, pair: 'LINK-ETH', icons: ['⬡', '⟠'], platform: 'SushiSwap', apy: 68.4, tvl: 3200000, multiplier: '50x', yourStaked: 0, pendingReward: 0 }
  ],
  selectedFarm: null,
  modalMode: 'stake'
};

// Format currency
function formatCurrency(value) {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return '$' + (value / 1000).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

// Calculate pending rewards
function updateRewards() {
  state.farms.forEach(farm => {
    if (farm.yourStaked > 0) {
      // Simulate reward accumulation
      const rewardRate = (farm.apy / 100) / (365 * 24 * 60 * 60);
      farm.pendingReward += farm.yourStaked * rewardRate;
    }
  });
}

// Update global stats
function updateStats() {
  const tvl = state.farms.reduce((sum, f) => sum + f.tvl, 0);
  const totalPending = state.farms.reduce((sum, f) => sum + f.pendingReward, 0);
  
  document.getElementById('totalValueLocked').textContent = formatCurrency(tvl);
  document.getElementById('farmBalance').textContent = state.farmBalance.toFixed(4) + ' FARM';
  document.getElementById('pendingRewards').textContent = totalPending.toFixed(6) + ' FARM';
}

// Render farms
function renderFarms() {
  const container = document.getElementById('farmsContainer');
  
  container.innerHTML = state.farms.map(farm => \`
    <div class="farm-card">
      <div class="farm-header">
        <div class="farm-pair">
          <div class="pair-icons">
            <span class="pair-icon">\${farm.icons[0]}</span>
            <span class="pair-icon">\${farm.icons[1]}</span>
          </div>
          <div class="pair-info">
            <span class="pair-name">\${farm.pair} LP</span>
            <span class="pair-platform">\${farm.platform}</span>
          </div>
        </div>
        <div class="farm-apy">
          <div class="apy-label">APY</div>
          <div class="apy-value">\${farm.apy}%</div>
        </div>
      </div>
      
      <div class="farm-stats">
        <div class="farm-stat">
          <div class="farm-stat-label">TVL</div>
          <div class="farm-stat-value">\${formatCurrency(farm.tvl)}</div>
        </div>
        <div class="farm-stat">
          <div class="farm-stat-label">Multiplier</div>
          <div class="farm-stat-value">\${farm.multiplier}</div>
        </div>
        <div class="farm-stat">
          <div class="farm-stat-label">Your Stake</div>
          <div class="farm-stat-value">\${farm.yourStaked.toFixed(4)} LP</div>
        </div>
        <div class="farm-stat">
          <div class="farm-stat-label">Earned</div>
          <div class="farm-stat-value" style="color: #34d399">\${farm.pendingReward.toFixed(6)} FARM</div>
        </div>
      </div>
      
      <div class="farm-actions">
        <button class="btn btn-primary" onclick="openStakeModal(\${farm.id})">
          \${farm.yourStaked > 0 ? 'Manage' : 'Stake'}
        </button>
        <button class="btn btn-secondary" onclick="harvest(\${farm.id})" \${farm.pendingReward <= 0 ? 'disabled style="opacity:0.5"' : ''}>
          🌾 Harvest
        </button>
      </div>
    </div>
  \`).join('');
}

// Open stake modal
function openStakeModal(farmId) {
  state.selectedFarm = farmId;
  state.modalMode = 'stake';
  
  const farm = state.farms[farmId];
  document.getElementById('modalTitle').textContent = farm.pair + ' LP';
  document.getElementById('lpAmount').value = '';
  
  updateModalView();
  document.getElementById('stakeModal').style.display = 'flex';
  
  console.log(\`[UI] Opened stake modal for \${farm.pair}\`);
}

// Switch modal tab
function switchModalTab(mode) {
  state.modalMode = mode;
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(\`.modal-tab:nth-child(\${mode === 'stake' ? 1 : 2})\`).classList.add('active');
  document.getElementById('confirmStakeBtn').textContent = mode === 'stake' ? 'Stake' : 'Unstake';
  updateModalView();
}

// Update modal view
function updateModalView() {
  const farm = state.farms[state.selectedFarm];
  const balance = state.modalMode === 'stake' 
    ? state.lpBalances[farm.pair] || 0 
    : farm.yourStaked;
  
  document.getElementById('balanceLabel').textContent = \`Balance: \${balance.toFixed(4)} LP\`;
  
  document.getElementById('stakePreview').innerHTML = \`
    <p>Pool: <strong>\${farm.pair}</strong></p>
    <p>APY: <strong style="color: #34d399">\${farm.apy}%</strong></p>
    <p>Current Stake: <strong>\${farm.yourStaked.toFixed(4)} LP</strong></p>
  \`;
}

function closeModal() {
  document.getElementById('stakeModal').style.display = 'none';
  state.selectedFarm = null;
}

function setMaxLP() {
  const farm = state.farms[state.selectedFarm];
  const max = state.modalMode === 'stake' 
    ? state.lpBalances[farm.pair] || 0 
    : farm.yourStaked;
  document.getElementById('lpAmount').value = max;
}

// Confirm stake/unstake
function confirmStake() {
  const amount = parseFloat(document.getElementById('lpAmount').value);
  const farm = state.farms[state.selectedFarm];
  
  if (!amount || amount <= 0) {
    console.error('[ERROR] Please enter a valid amount');
    return;
  }
  
  if (state.modalMode === 'stake') {
    const available = state.lpBalances[farm.pair] || 0;
    if (amount > available) {
      console.error('[ERROR] Insufficient LP balance');
      return;
    }
    
    state.lpBalances[farm.pair] -= amount;
    farm.yourStaked += amount;
    farm.tvl += amount * 100; // Simplified TVL update
    
    console.log(\`[TX] Staked \${amount} \${farm.pair} LP tokens\`);
    console.log(\`[CONTRACT] YieldFarm.deposit(\${farm.id}, \${amount})\`);
  } else {
    if (amount > farm.yourStaked) {
      console.error('[ERROR] Insufficient staked balance');
      return;
    }
    
    state.lpBalances[farm.pair] = (state.lpBalances[farm.pair] || 0) + amount;
    farm.yourStaked -= amount;
    farm.tvl -= amount * 100;
    
    console.log(\`[TX] Unstaked \${amount} \${farm.pair} LP tokens\`);
    console.log(\`[CONTRACT] YieldFarm.withdraw(\${farm.id}, \${amount})\`);
  }
  
  closeModal();
  renderFarms();
  updateStats();
}

// Harvest rewards
function harvest(farmId) {
  const farm = state.farms[farmId];
  
  if (farm.pendingReward <= 0) {
    console.error('[ERROR] No rewards to harvest');
    return;
  }
  
  const rewards = farm.pendingReward;
  state.farmBalance += rewards;
  farm.pendingReward = 0;
  
  console.log(\`[TX] Harvested \${rewards.toFixed(6)} FARM from \${farm.pair}\`);
  console.log(\`[CONTRACT] YieldFarm.harvest(\${farmId})\`);
  
  renderFarms();
  updateStats();
}

// Harvest all
function harvestAll() {
  let totalHarvested = 0;
  
  state.farms.forEach(farm => {
    if (farm.pendingReward > 0) {
      totalHarvested += farm.pendingReward;
      farm.pendingReward = 0;
    }
  });
  
  if (totalHarvested > 0) {
    state.farmBalance += totalHarvested;
    console.log(\`[TX] Harvested \${totalHarvested.toFixed(6)} FARM from all farms\`);
    renderFarms();
    updateStats();
  } else {
    console.log('[INFO] No rewards to harvest');
  }
}

// Initialize
renderFarms();
updateStats();

// Update rewards every second
setInterval(() => {
  updateRewards();
  renderFarms();
  updateStats();
}, 1000);

console.log('[INIT] Yield Farming dApp initialized');
console.log('[INFO] 4 farms available with up to 68.4% APY');`
  }
];

const contractFunctions = [
  {
    name: 'deposit',
    type: 'write' as const,
    inputs: [
      { name: 'farmId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'withdraw',
    type: 'write' as const,
    inputs: [
      { name: 'farmId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'harvest',
    type: 'write' as const,
    inputs: [
      { name: 'farmId', type: 'uint256' }
    ]
  },
  {
    name: 'pendingReward',
    type: 'read' as const,
    inputs: [
      { name: 'farmId', type: 'uint256' },
      { name: 'user', type: 'address' }
    ]
  },
  {
    name: 'farmCount',
    type: 'read' as const,
    inputs: []
  },
  {
    name: 'rewardPerSecond',
    type: 'read' as const,
    inputs: []
  }
];

export default function YieldFarmingFullStack() {
  return (
    <FullStackPlayground
      difficulty="Advanced"
      files={files}
      contractFunctions={contractFunctions}
      title="Yield Farming"
      description="Stake LP tokens to earn FARM rewards with high APY across multiple liquidity pools"
    />
  );
}
