/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep pushing boundaries 🚧
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'StakingPool.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StakingPool
 * @dev A flexible staking contract with multiple pool tiers
 * @notice Stake tokens to earn rewards with different lock periods
 */
contract StakingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    struct Pool {
        uint256 lockPeriod;      // Lock period in seconds
        uint256 apy;             // Annual percentage yield (basis points)
        uint256 totalStaked;     // Total tokens staked in this pool
        bool active;             // Is pool accepting new stakes
    }
    
    struct Stake {
        uint256 amount;          // Amount staked
        uint256 startTime;       // When stake was made
        uint256 poolId;          // Which pool
        uint256 rewardsClaimed;  // Rewards already claimed
    }
    
    Pool[] public pools;
    mapping(address => Stake[]) public userStakes;
    
    uint256 public totalStakedAllPools;
    
    event PoolCreated(uint256 indexed poolId, uint256 lockPeriod, uint256 apy);
    event Staked(address indexed user, uint256 indexed poolId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    
    constructor(address _stakingToken, address _rewardToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        
        // Create default pools
        pools.push(Pool(0, 550, 0, true));           // Flexible: 5.5% APY
        pools.push(Pool(30 days, 1250, 0, true));    // 30-day: 12.5% APY
        pools.push(Pool(90 days, 1880, 0, true));    // 90-day: 18.8% APY
        pools.push(Pool(365 days, 2500, 0, true));   // 365-day: 25% APY
    }
    
    function stake(uint256 poolId, uint256 amount) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        require(pools[poolId].active, "Pool not active");
        require(amount > 0, "Cannot stake 0");
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        userStakes[msg.sender].push(Stake({
            amount: amount,
            startTime: block.timestamp,
            poolId: poolId,
            rewardsClaimed: 0
        }));
        
        pools[poolId].totalStaked += amount;
        totalStakedAllPools += amount;
        
        emit Staked(msg.sender, poolId, amount);
    }
    
    function unstake(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Invalid stake");
        
        Stake storage userStake = userStakes[msg.sender][stakeId];
        Pool storage pool = pools[userStake.poolId];
        
        require(
            block.timestamp >= userStake.startTime + pool.lockPeriod,
            "Lock period not complete"
        );
        
        uint256 rewards = calculateRewards(msg.sender, stakeId);
        uint256 amount = userStake.amount;
        
        pool.totalStaked -= amount;
        totalStakedAllPools -= amount;
        
        // Remove stake by swapping with last
        userStakes[msg.sender][stakeId] = userStakes[msg.sender][userStakes[msg.sender].length - 1];
        userStakes[msg.sender].pop();
        
        stakingToken.safeTransfer(msg.sender, amount);
        if (rewards > 0) {
            rewardToken.safeTransfer(msg.sender, rewards);
        }
        
        emit Unstaked(msg.sender, stakeId, amount);
        emit RewardsClaimed(msg.sender, rewards);
    }
    
    function claimRewards(uint256 stakeId) external nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Invalid stake");
        
        uint256 rewards = calculateRewards(msg.sender, stakeId);
        require(rewards > 0, "No rewards to claim");
        
        userStakes[msg.sender][stakeId].rewardsClaimed += rewards;
        rewardToken.safeTransfer(msg.sender, rewards);
        
        emit RewardsClaimed(msg.sender, rewards);
    }
    
    function calculateRewards(address user, uint256 stakeId) public view returns (uint256) {
        Stake memory userStake = userStakes[user][stakeId];
        Pool memory pool = pools[userStake.poolId];
        
        uint256 timeStaked = block.timestamp - userStake.startTime;
        uint256 annualReward = (userStake.amount * pool.apy) / 10000;
        uint256 reward = (annualReward * timeStaked) / 365 days;
        
        return reward - userStake.rewardsClaimed;
    }
    
    function getUserStakes(address user) external view returns (Stake[] memory) {
        return userStakes[user];
    }
    
    function getPoolCount() external view returns (uint256) {
        return pools.length;
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
      <h1>🔒 Token Staking</h1>
      <p>Stake tokens to earn passive rewards</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Staked</span>
        <span id="totalStaked" class="stat-value">0 TOKENS</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Your Staked</span>
        <span id="yourStaked" class="stat-value">0 TOKENS</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Pending Rewards</span>
        <span id="pendingRewards" class="stat-value highlight">0 TOKENS</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Wallet Balance</span>
        <span id="walletBalance" class="stat-value">1,000 TOKENS</span>
      </div>
    </div>
    
    <div class="section">
      <h2>Staking Pools</h2>
      <div id="poolsContainer" class="pools-grid"></div>
    </div>
    
    <div class="section">
      <h2>Your Positions</h2>
      <div id="positionsContainer" class="positions-list">
        <div class="empty-state">No active positions</div>
      </div>
    </div>
  </div>
</div>

<!-- Stake Modal -->
<div id="stakeModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">Stake Tokens</h3>
      <button onclick="closeModal()" class="close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Amount to Stake</label>
        <div class="input-with-max">
          <input type="number" id="stakeAmount" placeholder="0.0" />
          <button onclick="setMaxAmount()" class="max-btn">MAX</button>
        </div>
      </div>
      <div id="stakePreview" class="preview-info"></div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-secondary">Cancel</button>
      <button onclick="confirmStake()" class="btn btn-primary">Stake Tokens</button>
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  color: #ffffff;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 32px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #94a3b8;
  font-size: 1.1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-label {
  display: block;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.stat-value.highlight {
  color: #10b981;
}

.section {
  margin-top: 32px;
}

.section h2 {
  font-size: 1.25rem;
  margin-bottom: 16px;
  color: #e2e8f0;
}

.pools-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.pool-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.pool-card:hover {
  border-color: #f59e0b;
  transform: translateY(-2px);
}

.pool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.pool-name {
  font-size: 1.1rem;
  font-weight: 600;
}

.pool-apy {
  font-size: 1.5rem;
  font-weight: 700;
  color: #10b981;
}

.pool-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.pool-detail {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #94a3b8;
}

.pool-detail span:last-child {
  color: #fff;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: scale(1.02);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.positions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 16px;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.position-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.position-label {
  font-size: 0.8rem;
  color: #94a3b8;
}

.position-value {
  font-size: 1rem;
  font-weight: 600;
}

.position-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 0.85rem;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba(255, 255, 255, 0.1);
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

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 0.9rem;
}

.input-with-max {
  display: flex;
  gap: 8px;
}

.input-with-max input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 12px 16px;
  color: white;
  font-size: 1.1rem;
}

.max-btn {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
}

.preview-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 16px;
  font-size: 0.9rem;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .pools-grid {
    grid-template-columns: 1fr;
  }
  
  .position-card {
    grid-template-columns: 1fr 1fr;
  }
}`
  },
  {
    id: 'js',
    name: 'app.js',
    language: 'javascript',
    code: `// Staking Pool Application
// Simulated blockchain state

const state = {
  walletBalance: 1000,
  pools: [
    { id: 0, name: 'Flexible Staking', apy: 5.5, lockPeriod: 0, totalStaked: 125000 },
    { id: 1, name: '30-Day Lock', apy: 12.5, lockPeriod: 30, totalStaked: 85000 },
    { id: 2, name: '90-Day Lock', apy: 18.8, lockPeriod: 90, totalStaked: 210000 },
    { id: 3, name: '365-Day Lock', apy: 25.0, lockPeriod: 365, totalStaked: 350000 }
  ],
  positions: [],
  selectedPool: null
};

// Format number with commas
function formatNumber(num, decimals = 2) {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
}

// Render all pools
function renderPools() {
  const container = document.getElementById('poolsContainer');
  container.innerHTML = state.pools.map(pool => \`
    <div class="pool-card">
      <div class="pool-header">
        <span class="pool-name">\${pool.name}</span>
        <span class="pool-apy">\${pool.apy}% APY</span>
      </div>
      <div class="pool-details">
        <div class="pool-detail">
          <span>Lock Period</span>
          <span>\${pool.lockPeriod === 0 ? 'None (Flexible)' : pool.lockPeriod + ' days'}</span>
        </div>
        <div class="pool-detail">
          <span>Total Staked</span>
          <span>\${formatNumber(pool.totalStaked, 0)} TOKENS</span>
        </div>
        <div class="pool-detail">
          <span>Your Share</span>
          <span>\${calculatePoolShare(pool.id)}%</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="openStakeModal(\${pool.id})">
        Stake in Pool
      </button>
    </div>
  \`).join('');
}

// Calculate user's share in a pool
function calculatePoolShare(poolId) {
  const pool = state.pools[poolId];
  const userStaked = state.positions
    .filter(p => p.poolId === poolId)
    .reduce((sum, p) => sum + p.amount, 0);
  
  if (pool.totalStaked === 0) return '0.00';
  return ((userStaked / pool.totalStaked) * 100).toFixed(2);
}

// Calculate pending rewards for a position
function calculateRewards(position) {
  const pool = state.pools[position.poolId];
  const timeElapsed = (Date.now() - position.startTime) / 1000; // seconds
  const annualReward = position.amount * (pool.apy / 100);
  const reward = (annualReward * timeElapsed) / (365 * 24 * 60 * 60);
  return reward - position.rewardsClaimed;
}

// Render user positions
function renderPositions() {
  const container = document.getElementById('positionsContainer');
  
  if (state.positions.length === 0) {
    container.innerHTML = '<div class="empty-state">No active positions. Stake tokens to start earning!</div>';
    return;
  }
  
  container.innerHTML = state.positions.map((pos, idx) => {
    const pool = state.pools[pos.poolId];
    const rewards = calculateRewards(pos);
    const timeStaked = Math.floor((Date.now() - pos.startTime) / 86400000);
    const canUnstake = pool.lockPeriod === 0 || timeStaked >= pool.lockPeriod;
    
    return \`
      <div class="position-card">
        <div class="position-info">
          <span class="position-label">Pool</span>
          <span class="position-value">\${pool.name}</span>
        </div>
        <div class="position-info">
          <span class="position-label">Staked</span>
          <span class="position-value">\${formatNumber(pos.amount)} TOKENS</span>
        </div>
        <div class="position-info">
          <span class="position-label">Rewards</span>
          <span class="position-value" style="color: #10b981">\${formatNumber(rewards, 4)} TOKENS</span>
        </div>
        <div class="position-actions">
          <button class="btn btn-secondary btn-sm" onclick="claimRewards(\${idx})">
            Claim
          </button>
          <button class="btn btn-primary btn-sm" onclick="unstake(\${idx})" \${!canUnstake ? 'disabled style="opacity:0.5"' : ''}>
            \${canUnstake ? 'Unstake' : \`\${pool.lockPeriod - timeStaked}d left\`}
          </button>
        </div>
      </div>
    \`;
  }).join('');
}

// Update stats display
function updateStats() {
  const totalStaked = state.pools.reduce((sum, p) => sum + p.totalStaked, 0);
  const yourStaked = state.positions.reduce((sum, p) => sum + p.amount, 0);
  const pendingRewards = state.positions.reduce((sum, p) => sum + calculateRewards(p), 0);
  
  document.getElementById('totalStaked').textContent = formatNumber(totalStaked, 0) + ' TOKENS';
  document.getElementById('yourStaked').textContent = formatNumber(yourStaked) + ' TOKENS';
  document.getElementById('pendingRewards').textContent = formatNumber(pendingRewards, 4) + ' TOKENS';
  document.getElementById('walletBalance').textContent = formatNumber(state.walletBalance) + ' TOKENS';
}

// Modal functions
function openStakeModal(poolId) {
  state.selectedPool = poolId;
  const pool = state.pools[poolId];
  
  document.getElementById('modalTitle').textContent = \`Stake in \${pool.name}\`;
  document.getElementById('stakeAmount').value = '';
  document.getElementById('stakePreview').innerHTML = \`
    <p>APY: <strong>\${pool.apy}%</strong></p>
    <p>Lock Period: <strong>\${pool.lockPeriod === 0 ? 'None' : pool.lockPeriod + ' days'}</strong></p>
  \`;
  
  document.getElementById('stakeModal').style.display = 'flex';
  console.log(\`[UI] Opened stake modal for pool: \${pool.name}\`);
}

function closeModal() {
  document.getElementById('stakeModal').style.display = 'none';
  state.selectedPool = null;
}

function setMaxAmount() {
  document.getElementById('stakeAmount').value = state.walletBalance;
}

// Stake tokens
function confirmStake() {
  const amount = parseFloat(document.getElementById('stakeAmount').value);
  
  if (!amount || amount <= 0) {
    console.error('[ERROR] Please enter a valid amount');
    return;
  }
  
  if (amount > state.walletBalance) {
    console.error('[ERROR] Insufficient balance');
    return;
  }
  
  const pool = state.pools[state.selectedPool];
  
  // Update state
  state.walletBalance -= amount;
  pool.totalStaked += amount;
  state.positions.push({
    poolId: state.selectedPool,
    amount: amount,
    startTime: Date.now(),
    rewardsClaimed: 0
  });
  
  console.log(\`[TX] Staked \${formatNumber(amount)} TOKENS in \${pool.name}\`);
  console.log(\`[CONTRACT] StakingPool.stake(\${state.selectedPool}, \${amount})\`);
  
  closeModal();
  renderAll();
}

// Claim rewards
function claimRewards(positionIdx) {
  const position = state.positions[positionIdx];
  const rewards = calculateRewards(position);
  
  if (rewards <= 0) {
    console.error('[ERROR] No rewards to claim');
    return;
  }
  
  position.rewardsClaimed += rewards;
  state.walletBalance += rewards;
  
  console.log(\`[TX] Claimed \${formatNumber(rewards, 4)} TOKENS in rewards\`);
  console.log(\`[CONTRACT] StakingPool.claimRewards(\${positionIdx})\`);
  
  renderAll();
}

// Unstake tokens
function unstake(positionIdx) {
  const position = state.positions[positionIdx];
  const pool = state.pools[position.poolId];
  const rewards = calculateRewards(position);
  
  // Return staked + rewards
  state.walletBalance += position.amount + rewards;
  pool.totalStaked -= position.amount;
  
  console.log(\`[TX] Unstaked \${formatNumber(position.amount)} TOKENS + \${formatNumber(rewards, 4)} rewards\`);
  console.log(\`[CONTRACT] StakingPool.unstake(\${positionIdx})\`);
  
  // Remove position
  state.positions.splice(positionIdx, 1);
  renderAll();
}

// Render everything
function renderAll() {
  renderPools();
  renderPositions();
  updateStats();
}

// Initialize
renderAll();

// Update rewards every second
setInterval(() => {
  renderPositions();
  updateStats();
}, 1000);

console.log('[INIT] Staking Pool dApp initialized');
console.log('[INFO] 4 pools available with APY ranging from 5.5% to 25%');`
  }
];

const contractFunctions = [
  {
    name: 'stake',
    type: 'write' as const,
    inputs: [
      { name: 'poolId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ]
  },
  {
    name: 'unstake',
    type: 'write' as const,
    inputs: [
      { name: 'stakeId', type: 'uint256' }
    ]
  },
  {
    name: 'claimRewards',
    type: 'write' as const,
    inputs: [
      { name: 'stakeId', type: 'uint256' }
    ]
  },
  {
    name: 'calculateRewards',
    type: 'read' as const,
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'stakeId', type: 'uint256' }
    ]
  },
  {
    name: 'getUserStakes',
    type: 'read' as const,
    inputs: [
      { name: 'user', type: 'address' }
    ]
  },
  {
    name: 'getPoolCount',
    type: 'read' as const,
    inputs: []
  },
  {
    name: 'totalStakedAllPools',
    type: 'read' as const,
    inputs: []
  }
];

export default function StakingFullStack() {
  return (
    <FullStackPlayground
      difficulty="Intermediate"
      files={files}
      contractFunctions={contractFunctions}
      title="Token Staking"
      description="Stake tokens in various pools to earn passive rewards with different lock periods and APY rates"
    />
  );
}
