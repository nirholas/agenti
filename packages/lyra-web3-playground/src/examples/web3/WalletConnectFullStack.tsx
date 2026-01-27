/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code with purpose, build with passion 🔥
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'WalletRegistry.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WalletRegistry - Track connected wallets on-chain
/// @notice Simple contract to demonstrate wallet connection with blockchain interaction
contract WalletRegistry {
    // Mapping of registered wallets
    mapping(address => bool) public isRegistered;
    mapping(address => uint256) public registrationTime;
    mapping(address => string) public usernames;
    
    // Stats
    uint256 public totalRegistered;
    
    // Events
    event WalletRegistered(address indexed wallet, string username, uint256 timestamp);
    event UsernameUpdated(address indexed wallet, string newUsername);
    
    /// @notice Register the caller's wallet
    /// @param username Optional username for the wallet
    function register(string memory username) external {
        require(!isRegistered[msg.sender], "Already registered");
        
        isRegistered[msg.sender] = true;
        registrationTime[msg.sender] = block.timestamp;
        usernames[msg.sender] = username;
        totalRegistered++;
        
        emit WalletRegistered(msg.sender, username, block.timestamp);
    }
    
    /// @notice Update username
    /// @param newUsername New username to set
    function updateUsername(string memory newUsername) external {
        require(isRegistered[msg.sender], "Not registered");
        usernames[msg.sender] = newUsername;
        emit UsernameUpdated(msg.sender, newUsername);
    }
    
    /// @notice Check if a wallet is registered
    /// @param wallet Address to check
    function checkRegistration(address wallet) external view returns (bool registered, string memory username) {
        return (isRegistered[wallet], usernames[wallet]);
    }
    
    /// @notice Get registration info
    function getMyInfo() external view returns (bool registered, uint256 regTime, string memory username) {
        return (isRegistered[msg.sender], registrationTime[msg.sender], usernames[msg.sender]);
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
      <div class="logo">🦊</div>
      <h1>Wallet Connect</h1>
      <p>Connect your wallet and interact with the blockchain</p>
    </div>
    
    <div id="notConnected" class="connect-section">
      <button id="connectBtn" class="connect-btn">
        <span class="btn-icon">🔗</span>
        Connect MetaMask
      </button>
      <p class="hint">Make sure MetaMask is installed</p>
    </div>
    
    <div id="connected" class="wallet-info" style="display: none;">
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Address</span>
          <span id="address" class="value mono"></span>
        </div>
        <div class="info-item">
          <span class="label">Balance</span>
          <span id="balance" class="value"></span>
        </div>
        <div class="info-item">
          <span class="label">Network</span>
          <span id="network" class="value"></span>
        </div>
        <div class="info-item">
          <span class="label">Block Number</span>
          <span id="blockNumber" class="value"></span>
        </div>
      </div>
      
      <div class="register-section">
        <h3>📝 Register on Blockchain</h3>
        <p>Store your info on-chain using the smart contract</p>
        <div class="form-row">
          <input type="text" id="username" placeholder="Enter username" />
          <button id="registerBtn" class="action-btn">Register</button>
        </div>
        <div id="regStatus" class="reg-status"></div>
      </div>
      
      <button id="disconnectBtn" class="disconnect-btn">
        Disconnect Wallet
      </button>
    </div>
    
    <div class="stats">
      <div class="stat">
        <span class="stat-value" id="totalUsers">0</span>
        <span class="stat-label">Registered Users</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="contractAddr">--</span>
        <span class="stat-label">Contract</span>
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 20px;
}

.app {
  width: 100%;
  max-width: 480px;
}

.card {
  background: white;
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  font-size: 48px;
  margin-bottom: 16px;
}

.header h1 {
  color: #1a1a2e;
  font-size: 28px;
  margin: 0 0 8px;
}

.header p {
  color: #64748b;
  margin: 0;
  font-size: 14px;
}

.connect-section {
  text-align: center;
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 18px 48px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
}

.connect-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.5);
}

.connect-btn:active {
  transform: translateY(-1px);
}

.hint {
  color: #94a3b8;
  font-size: 13px;
  margin-top: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.info-item {
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
}

.info-item .label {
  display: block;
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.info-item .value {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.info-item .value.mono {
  font-family: 'SF Mono', monospace;
  font-size: 12px;
}

.register-section {
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 16px;
}

.register-section h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #0369a1;
}

.register-section p {
  margin: 0 0 16px;
  font-size: 13px;
  color: #64748b;
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-row input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-row input:focus {
  outline: none;
  border-color: #667eea;
}

.action-btn {
  padding: 12px 24px;
  background: #0ea5e9;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #0284c7;
}

.reg-status {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  display: none;
}

.reg-status.success {
  display: block;
  background: #d1fae5;
  color: #065f46;
}

.reg-status.error {
  display: block;
  background: #fee2e2;
  color: #991b1b;
}

.disconnect-btn {
  width: 100%;
  padding: 14px;
  background: #fef2f2;
  color: #dc2626;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.disconnect-btn:hover {
  background: #fee2e2;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
}`
  },
  {
    id: 'javascript',
    name: 'app.js',
    language: 'javascript',
    code: `// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const registerBtn = document.getElementById('registerBtn');
const notConnected = document.getElementById('notConnected');
const connected = document.getElementById('connected');
const addressEl = document.getElementById('address');
const balanceEl = document.getElementById('balance');
const networkEl = document.getElementById('network');
const blockNumberEl = document.getElementById('blockNumber');
const usernameInput = document.getElementById('username');
const regStatus = document.getElementById('regStatus');
const totalUsers = document.getElementById('totalUsers');
const contractAddr = document.getElementById('contractAddr');

// Networks
const networks = {
  1: { name: 'Ethereum', symbol: 'ETH' },
  5: { name: 'Goerli', symbol: 'ETH' },
  11155111: { name: 'Sepolia', symbol: 'ETH' },
  137: { name: 'Polygon', symbol: 'MATIC' },
  42161: { name: 'Arbitrum', symbol: 'ETH' }
};

// State
let currentAccount = null;
let registeredUsers = 0;

// Initialize
function init() {
  // Check contract deployment
  if (window.IS_DEPLOYED && window.CONTRACT_ADDRESS) {
    const addr = window.CONTRACT_ADDRESS;
    contractAddr.textContent = addr.slice(0, 6) + '...' + addr.slice(-4);
  }
  
  if (window.CONTRACT_STATE) {
    registeredUsers = window.CONTRACT_STATE.totalSupply || 0;
    totalUsers.textContent = registeredUsers;
  }
}

// Format address
function formatAddress(addr) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Connect wallet
async function connectWallet() {
  try {
    connectBtn.innerHTML = '<span class="btn-icon">⏳</span> Connecting...';
    
    // Simulate connection delay
    await new Promise(r => setTimeout(r, 1000));
    
    // Demo account
    currentAccount = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Update UI
    addressEl.textContent = formatAddress(currentAccount);
    balanceEl.textContent = (Math.random() * 10).toFixed(4) + ' ETH';
    networkEl.textContent = 'Ethereum Mainnet';
    blockNumberEl.textContent = (19000000 + Math.floor(Math.random() * 100000)).toLocaleString();
    
    notConnected.style.display = 'none';
    connected.style.display = 'block';
    
    console.log('Wallet connected:', currentAccount);
  } catch (error) {
    console.error('Connection failed:', error);
    connectBtn.innerHTML = '<span class="btn-icon">🔗</span> Connect MetaMask';
  }
}

// Disconnect wallet
function disconnectWallet() {
  currentAccount = null;
  notConnected.style.display = 'block';
  connected.style.display = 'none';
  connectBtn.innerHTML = '<span class="btn-icon">🔗</span> Connect MetaMask';
  console.log('Wallet disconnected');
}

// Register on blockchain
async function registerUser() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showRegStatus('Please enter a username', 'error');
    return;
  }
  
  if (!window.IS_DEPLOYED) {
    showRegStatus('Deploy the contract first!', 'error');
    return;
  }
  
  registerBtn.textContent = 'Registering...';
  registerBtn.disabled = true;
  
  // Simulate blockchain transaction
  await new Promise(r => setTimeout(r, 2000));
  
  registeredUsers++;
  totalUsers.textContent = registeredUsers;
  
  showRegStatus('✅ Successfully registered as "' + username + '"!', 'success');
  console.log('User registered:', username, 'Address:', currentAccount);
  
  usernameInput.value = '';
  registerBtn.textContent = 'Register';
  registerBtn.disabled = false;
}

function showRegStatus(message, type) {
  regStatus.textContent = message;
  regStatus.className = 'reg-status ' + type;
  setTimeout(() => {
    regStatus.style.display = 'none';
  }, 5000);
}

// Event listeners
connectBtn.addEventListener('click', connectWallet);
disconnectBtn.addEventListener('click', disconnectWallet);
registerBtn.addEventListener('click', registerUser);

// Initialize
init();
setInterval(init, 1000);

console.log('Wallet Connect dApp initialized');`
  }
];

const contractFunctions = [
  {
    name: 'register',
    type: 'write' as const,
    inputs: [{ name: 'username', type: 'string' }]
  },
  {
    name: 'updateUsername',
    type: 'write' as const,
    inputs: [{ name: 'newUsername', type: 'string' }]
  },
  {
    name: 'checkRegistration',
    type: 'read' as const,
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: ['bool', 'string']
  },
  {
    name: 'totalRegistered',
    type: 'read' as const,
    inputs: [],
    outputs: ['uint256']
  }
];

export default function WalletConnectFullStack() {
  return (
    <FullStackPlayground
      title="Wallet Connect dApp"
      description="Complete wallet connection with on-chain registration using Solidity and JavaScript"
      difficulty="Beginner"
      files={files}
      contractFunctions={contractFunctions}
      initialState={{ totalSupply: 0 }}
    />
  );
}
