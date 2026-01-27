/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 AI-powered full-stack dApp builder 🚀
 */

import { useState } from 'react';
import { 
  Sparkles, 
  Code, 
  Layout, 
  Zap, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Wand2,
  Layers,
  FileCode,
  Palette
} from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';
import FullStackPlayground from '@/components/Playground/FullStackPlayground';

interface GeneratedProject {
  contract: string;
  html: string;
  css: string;
  javascript: string;
}

const projectTemplates: Record<string, GeneratedProject> = {
  'token': {
    contract: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyToken - AI Generated ERC20 Token
/// @notice A simple ERC20 token with minting capabilities
contract MyToken is ERC20, Ownable {
    uint256 public maxSupply;
    
    event TokensMinted(address indexed to, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        maxSupply = _maxSupply * 10 ** decimals();
        _mint(msg.sender, maxSupply / 2); // Mint 50% to deployer
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}`,
    html: `<div class="app">
  <div class="token-dashboard">
    <div class="header">
      <div class="logo">
        <span class="icon">🪙</span>
        <h1>My Token Dashboard</h1>
      </div>
      <button id="connectWallet" class="btn-connect">
        Connect Wallet
      </button>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Supply</span>
        <span id="totalSupply" class="stat-value">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Your Balance</span>
        <span id="userBalance" class="stat-value">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Max Supply</span>
        <span id="maxSupply" class="stat-value">0</span>
      </div>
    </div>
    
    <div class="actions-panel">
      <div class="action-card">
        <h3>Transfer Tokens</h3>
        <input type="text" id="transferTo" placeholder="Recipient address" />
        <input type="number" id="transferAmount" placeholder="Amount" />
        <button id="transferBtn" class="btn-primary">Transfer</button>
      </div>
      
      <div class="action-card">
        <h3>Burn Tokens</h3>
        <input type="number" id="burnAmount" placeholder="Amount to burn" />
        <button id="burnBtn" class="btn-danger">Burn</button>
      </div>
    </div>
    
    <div id="txStatus" class="tx-status hidden"></div>
  </div>
</div>`,
    css: `.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  font-family: 'Inter', sans-serif;
}

.token-dashboard {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo .icon {
  font-size: 2.5rem;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
}

.btn-connect {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-connect:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%);
  padding: 1.5rem;
  border-radius: 16px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
}

.actions-panel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.action-card {
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}

.action-card h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #334155;
}

.action-card input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.action-card input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn-primary {
  width: 100%;
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #5a67d8;
}

.btn-danger {
  width: 100%;
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #dc2626;
}

.tx-status {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  text-align: center;
  font-weight: 500;
}

.tx-status.success {
  background: #d1fae5;
  color: #065f46;
}

.tx-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.hidden {
  display: none;
}`,
    javascript: `// Token Dashboard - AI Generated Frontend
// Connect with ethers.js

let provider;
let signer;
let contract;

const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
const ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function burn(uint256 amount)"
];

// Connect wallet
document.getElementById('connectWallet').addEventListener('click', async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      
      document.getElementById('connectWallet').textContent = 
        \`\${(await signer.getAddress()).slice(0, 6)}...\${(await signer.getAddress()).slice(-4)}\`;
      
      await loadContractData();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  } else {
    alert('Please install MetaMask!');
  }
});

// Load contract data
async function loadContractData() {
  if (!signer) return;
  
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  
  try {
    const totalSupply = await contract.totalSupply();
    const maxSupply = await contract.maxSupply();
    const userBalance = await contract.balanceOf(await signer.getAddress());
    
    document.getElementById('totalSupply').textContent = 
      ethers.formatEther(totalSupply) + ' tokens';
    document.getElementById('maxSupply').textContent = 
      ethers.formatEther(maxSupply) + ' tokens';
    document.getElementById('userBalance').textContent = 
      ethers.formatEther(userBalance) + ' tokens';
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

// Transfer tokens
document.getElementById('transferBtn').addEventListener('click', async () => {
  const to = document.getElementById('transferTo').value;
  const amount = document.getElementById('transferAmount').value;
  
  if (!to || !amount) {
    showStatus('Please fill all fields', 'error');
    return;
  }
  
  try {
    const tx = await contract.transfer(to, ethers.parseEther(amount));
    showStatus('Transaction pending...', 'pending');
    await tx.wait();
    showStatus('Transfer successful!', 'success');
    await loadContractData();
  } catch (err) {
    showStatus('Transfer failed: ' + err.message, 'error');
  }
});

// Burn tokens
document.getElementById('burnBtn').addEventListener('click', async () => {
  const amount = document.getElementById('burnAmount').value;
  
  if (!amount) {
    showStatus('Please enter amount', 'error');
    return;
  }
  
  try {
    const tx = await contract.burn(ethers.parseEther(amount));
    showStatus('Transaction pending...', 'pending');
    await tx.wait();
    showStatus('Tokens burned!', 'success');
    await loadContractData();
  } catch (err) {
    showStatus('Burn failed: ' + err.message, 'error');
  }
});

function showStatus(message, type) {
  const el = document.getElementById('txStatus');
  el.textContent = message;
  el.className = 'tx-status ' + type;
}`
  },
  'nft': {
    contract: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyNFT - AI Generated NFT Collection
/// @notice A customizable NFT collection with minting
contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    uint256 public maxSupply;
    uint256 public mintPrice;
    bool public isMintingActive;
    
    event NFTMinted(address indexed to, uint256 tokenId, string tokenURI);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) ERC721(name, symbol) Ownable(msg.sender) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        isMintingActive = true;
    }
    
    function mint(string memory uri) public payable {
        require(isMintingActive, "Minting is paused");
        require(_tokenIds < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, uri);
        
        emit NFTMinted(msg.sender, newItemId, uri);
    }
    
    function totalSupply() public view returns (uint256) {
        return _tokenIds;
    }
    
    function toggleMinting() public onlyOwner {
        isMintingActive = !isMintingActive;
    }
    
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}`,
    html: `<div class="app">
  <div class="nft-gallery">
    <div class="header">
      <div class="logo">
        <span class="icon">🎨</span>
        <h1>NFT Collection</h1>
      </div>
      <button id="connectWallet" class="btn-connect">
        Connect Wallet
      </button>
    </div>
    
    <div class="hero-section">
      <div class="hero-content">
        <h2>Exclusive Digital Art</h2>
        <p>Mint your unique NFT from our AI-generated collection</p>
        <div class="mint-info">
          <span id="mintedCount">0</span> / <span id="maxSupply">100</span> Minted
        </div>
        <div class="price-tag">
          <span class="label">Mint Price</span>
          <span id="mintPrice" class="price">0.01 ETH</span>
        </div>
      </div>
    </div>
    
    <div class="mint-section">
      <div class="nft-preview">
        <div class="preview-placeholder">
          <span>🖼️</span>
          <p>Your NFT Preview</p>
        </div>
      </div>
      
      <div class="mint-controls">
        <input type="text" id="tokenURI" placeholder="Enter metadata URI (ipfs://...)" />
        <button id="mintBtn" class="btn-mint">
          <span class="icon">✨</span>
          Mint NFT
        </button>
      </div>
    </div>
    
    <div id="txStatus" class="tx-status hidden"></div>
    
    <div class="my-nfts">
      <h3>Your NFTs</h3>
      <div id="nftGrid" class="nft-grid">
        <p class="empty-state">Connect wallet to see your NFTs</p>
      </div>
    </div>
  </div>
</div>`,
    css: `.app {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
  padding: 2rem;
  font-family: 'Inter', sans-serif;
  color: white;
}

.nft-gallery {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo .icon {
  font-size: 2.5rem;
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.btn-connect {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-connect:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.hero-section {
  text-align: center;
  padding: 3rem 0;
}

.hero-content h2 {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-content p {
  color: #a0aec0;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.mint-info {
  font-size: 1.25rem;
  color: #f093fb;
  margin-bottom: 1rem;
}

.price-tag {
  display: inline-flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem 2rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.price-tag .label {
  font-size: 0.75rem;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.price-tag .price {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f5576c;
}

.mint-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 2rem;
}

.nft-preview {
  margin-bottom: 1.5rem;
}

.preview-placeholder {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  padding: 4rem;
  text-align: center;
  border: 2px dashed rgba(255, 255, 255, 0.2);
}

.preview-placeholder span {
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
}

.preview-placeholder p {
  color: #a0aec0;
}

.mint-controls {
  display: flex;
  gap: 1rem;
}

.mint-controls input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem;
  border-radius: 12px;
  color: white;
  font-size: 1rem;
}

.mint-controls input:focus {
  outline: none;
  border-color: #f093fb;
}

.btn-mint {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-mint:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(240, 147, 251, 0.3);
}

.tx-status {
  padding: 1rem;
  border-radius: 12px;
  text-align: center;
  margin-bottom: 2rem;
}

.tx-status.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.tx-status.error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.tx-status.pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.hidden { display: none; }

.my-nfts h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #a0aec0;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}`,
    javascript: `// NFT Dashboard - AI Generated Frontend
let provider;
let signer;
let contract;

const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
const ABI = [
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function isMintingActive() view returns (bool)",
  "function mint(string memory uri) payable",
  "function balanceOf(address) view returns (uint256)"
];

document.getElementById('connectWallet').addEventListener('click', async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      
      const addr = await signer.getAddress();
      document.getElementById('connectWallet').textContent = 
        \`\${addr.slice(0, 6)}...\${addr.slice(-4)}\`;
      
      await loadContractData();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  } else {
    alert('Please install MetaMask!');
  }
});

async function loadContractData() {
  if (!signer) return;
  
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  
  try {
    const totalSupply = await contract.totalSupply();
    const maxSupply = await contract.maxSupply();
    const mintPrice = await contract.mintPrice();
    
    document.getElementById('mintedCount').textContent = totalSupply.toString();
    document.getElementById('maxSupply').textContent = maxSupply.toString();
    document.getElementById('mintPrice').textContent = 
      ethers.formatEther(mintPrice) + ' ETH';
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

document.getElementById('mintBtn').addEventListener('click', async () => {
  const uri = document.getElementById('tokenURI').value;
  
  if (!uri) {
    showStatus('Please enter token URI', 'error');
    return;
  }
  
  try {
    const mintPrice = await contract.mintPrice();
    const tx = await contract.mint(uri, { value: mintPrice });
    showStatus('Minting in progress...', 'pending');
    await tx.wait();
    showStatus('NFT Minted Successfully! 🎉', 'success');
    await loadContractData();
  } catch (err) {
    showStatus('Mint failed: ' + err.message, 'error');
  }
});

function showStatus(message, type) {
  const el = document.getElementById('txStatus');
  el.textContent = message;
  el.className = 'tx-status ' + type;
}`
  },
  'dao': {
    contract: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimpleDAO - AI Generated Governance
/// @notice A basic DAO with proposal and voting
contract SimpleDAO {
    struct Proposal {
        uint256 id;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        mapping(address => bool) hasVoted;
    }
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public memberPower;
    
    uint256 public proposalCount;
    uint256 public totalMembers;
    uint256 public votingPeriod = 3 days;
    
    event ProposalCreated(uint256 id, string description);
    event Voted(uint256 proposalId, address voter, bool support);
    event MemberJoined(address member, uint256 power);
    
    function join() public payable {
        require(msg.value >= 0.01 ether, "Min 0.01 ETH to join");
        require(memberPower[msg.sender] == 0, "Already a member");
        
        memberPower[msg.sender] = msg.value;
        totalMembers++;
        
        emit MemberJoined(msg.sender, msg.value);
    }
    
    function createProposal(string memory description) public returns (uint256) {
        require(memberPower[msg.sender] > 0, "Must be a member");
        
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.id = proposalCount;
        p.description = description;
        p.deadline = block.timestamp + votingPeriod;
        
        emit ProposalCreated(proposalCount, description);
        return proposalCount;
    }
    
    function vote(uint256 proposalId, bool support) public {
        require(memberPower[msg.sender] > 0, "Must be a member");
        
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting ended");
        require(!p.hasVoted[msg.sender], "Already voted");
        
        p.hasVoted[msg.sender] = true;
        uint256 power = memberPower[msg.sender];
        
        if (support) {
            p.votesFor += power;
        } else {
            p.votesAgainst += power;
        }
        
        emit Voted(proposalId, msg.sender, support);
    }
    
    function getProposalResult(uint256 proposalId) public view returns (bool passed) {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.deadline, "Voting not ended");
        return p.votesFor > p.votesAgainst;
    }
}`,
    html: `<div class="app">
  <div class="dao-dashboard">
    <div class="header">
      <div class="logo">
        <span class="icon">🏛️</span>
        <h1>DAO Governance</h1>
      </div>
      <button id="connectWallet" class="btn-connect">Connect Wallet</button>
    </div>
    
    <div class="stats-bar">
      <div class="stat">
        <span class="label">Members</span>
        <span id="memberCount" class="value">0</span>
      </div>
      <div class="stat">
        <span class="label">Proposals</span>
        <span id="proposalCount" class="value">0</span>
      </div>
      <div class="stat">
        <span class="label">Your Power</span>
        <span id="votingPower" class="value">0 ETH</span>
      </div>
    </div>
    
    <div class="join-section" id="joinSection">
      <h3>Join the DAO</h3>
      <p>Stake ETH to become a member and gain voting power</p>
      <input type="number" id="stakeAmount" placeholder="ETH amount (min 0.01)" step="0.01" />
      <button id="joinBtn" class="btn-primary">Join DAO</button>
    </div>
    
    <div class="proposals-section">
      <div class="section-header">
        <h3>Active Proposals</h3>
        <button id="newProposalBtn" class="btn-secondary">+ New Proposal</button>
      </div>
      
      <div id="proposalModal" class="modal hidden">
        <div class="modal-content">
          <h4>Create Proposal</h4>
          <textarea id="proposalDesc" placeholder="Describe your proposal..."></textarea>
          <div class="modal-actions">
            <button id="cancelProposal" class="btn-secondary">Cancel</button>
            <button id="submitProposal" class="btn-primary">Submit</button>
          </div>
        </div>
      </div>
      
      <div id="proposalsList" class="proposals-list">
        <p class="empty-state">No active proposals</p>
      </div>
    </div>
    
    <div id="txStatus" class="tx-status hidden"></div>
  </div>
</div>`,
    css: `.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 2rem;
  font-family: 'Inter', sans-serif;
  color: white;
}

.dao-dashboard {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo .icon { font-size: 2.5rem; }
.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.btn-connect {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.stats-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  border-radius: 16px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat .label {
  display: block;
  font-size: 0.75rem;
  color: #a0aec0;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.stat .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4facfe;
}

.join-section, .proposals-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.join-section h3, .proposals-section h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.join-section p { color: #a0aec0; margin-bottom: 1.5rem; }

.join-section input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem;
  border-radius: 12px;
  color: white;
  margin-bottom: 1rem;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: #1a1a2e;
  padding: 2rem;
  border-radius: 20px;
  width: 90%;
  max-width: 500px;
}

.modal-content textarea {
  width: 100%;
  height: 150px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 1rem;
  color: white;
  margin: 1rem 0;
  resize: none;
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.modal-actions button { flex: 1; }

.proposals-list { min-height: 200px; }
.empty-state { text-align: center; color: #6b7280; padding: 3rem; }

.hidden { display: none; }
.tx-status { padding: 1rem; border-radius: 12px; text-align: center; }
.tx-status.success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.tx-status.error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }`,
    javascript: `// DAO Dashboard - AI Generated
let provider, signer, contract;

const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
const ABI = [
  "function join() payable",
  "function memberPower(address) view returns (uint256)",
  "function totalMembers() view returns (uint256)",
  "function proposalCount() view returns (uint256)",
  "function createProposal(string memory description) returns (uint256)",
  "function vote(uint256 proposalId, bool support)"
];

document.getElementById('connectWallet').addEventListener('click', async () => {
  if (window.ethereum) {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const addr = await signer.getAddress();
    document.getElementById('connectWallet').textContent = addr.slice(0,6) + '...' + addr.slice(-4);
    await loadData();
  }
});

async function loadData() {
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const power = await contract.memberPower(await signer.getAddress());
  const members = await contract.totalMembers();
  const proposals = await contract.proposalCount();
  
  document.getElementById('votingPower').textContent = ethers.formatEther(power) + ' ETH';
  document.getElementById('memberCount').textContent = members.toString();
  document.getElementById('proposalCount').textContent = proposals.toString();
  
  if (power > 0) document.getElementById('joinSection').style.display = 'none';
}

document.getElementById('joinBtn').addEventListener('click', async () => {
  const amount = document.getElementById('stakeAmount').value;
  if (!amount || parseFloat(amount) < 0.01) {
    showStatus('Min 0.01 ETH required', 'error');
    return;
  }
  try {
    const tx = await contract.join({ value: ethers.parseEther(amount) });
    await tx.wait();
    showStatus('Welcome to the DAO!', 'success');
    await loadData();
  } catch (err) {
    showStatus('Join failed: ' + err.message, 'error');
  }
});

document.getElementById('newProposalBtn').addEventListener('click', () => {
  document.getElementById('proposalModal').classList.remove('hidden');
});

document.getElementById('cancelProposal').addEventListener('click', () => {
  document.getElementById('proposalModal').classList.add('hidden');
});

document.getElementById('submitProposal').addEventListener('click', async () => {
  const desc = document.getElementById('proposalDesc').value;
  if (!desc) return;
  try {
    const tx = await contract.createProposal(desc);
    await tx.wait();
    showStatus('Proposal created!', 'success');
    document.getElementById('proposalModal').classList.add('hidden');
    await loadData();
  } catch (err) {
    showStatus('Failed: ' + err.message, 'error');
  }
});

function showStatus(msg, type) {
  const el = document.getElementById('txStatus');
  el.textContent = msg;
  el.className = 'tx-status ' + type;
}`
  }
};

export default function AIFullStackBuilder() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null);
  const [showPlayground, setShowPlayground] = useState(false);

  const examplePrompts = [
    { icon: '🪙', text: 'Build an ERC20 token dashboard with transfer and burn functionality' },
    { icon: '🎨', text: 'Create an NFT minting dApp with collection gallery' },
    { icon: '🏛️', text: 'Make a DAO governance interface with proposals and voting' },
    { icon: '💱', text: 'Build a token swap DEX with liquidity pools' },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe the dApp you want to build');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedProject(null);

    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Match keywords to templates
      const lowerPrompt = prompt.toLowerCase();
      let template: GeneratedProject;
      
      if (lowerPrompt.includes('nft') || lowerPrompt.includes('mint') || lowerPrompt.includes('collectible') || lowerPrompt.includes('721')) {
        template = projectTemplates['nft'];
      } else if (lowerPrompt.includes('dao') || lowerPrompt.includes('governance') || lowerPrompt.includes('vote') || lowerPrompt.includes('proposal')) {
        template = projectTemplates['dao'];
      } else {
        template = projectTemplates['token'];
      }

      setGeneratedProject(template);
      setShowPlayground(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate project');
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert to playground file format
  const getPlaygroundFiles = () => {
    if (!generatedProject) return [];
    
    return [
      {
        id: 'contract',
        name: 'Contract.sol',
        language: 'solidity',
        code: generatedProject.contract
      },
      {
        id: 'html',
        name: 'index.html',
        language: 'html',
        code: generatedProject.html
      },
      {
        id: 'css',
        name: 'styles.css',
        language: 'css',
        code: generatedProject.css
      },
      {
        id: 'js',
        name: 'app.js',
        language: 'javascript',
        code: generatedProject.javascript
      }
    ];
  };

  if (showPlayground && generatedProject) {
    return (
      <div className="h-full">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            <div>
              <h2 className="font-bold">AI-Generated Full-Stack dApp</h2>
              <p className="text-sm text-white/80">Edit the code, preview live, and deploy!</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowPlayground(false);
              setGeneratedProject(null);
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            ← Generate New
          </button>
        </div>
        
        <FullStackPlayground
          files={getPlaygroundFiles()}
          title="AI-Generated dApp"
          description="Full-stack dApp with smart contract and frontend"
          difficulty="Beginner"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl mb-6 shadow-lg">
          <Wand2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
          AI Full-Stack dApp Builder
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Describe your dApp in natural language and get a complete project with smart contract, 
          frontend UI, and JavaScript integration ready to customize and deploy.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-600" />
          Describe Your dApp
        </h2>
        
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Example: Build an NFT minting dApp with a gallery to display my collection, mint button, and wallet connection..."
          className="w-full h-32 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
        />

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full mt-4 btn-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg font-semibold"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3" />
              Generating Your Full-Stack dApp...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-2" />
              Generate Full-Stack dApp
            </>
          )}
        </button>
      </div>

      {/* Example Prompts */}
      <div className="card mb-8">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Try These Examples
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {examplePrompts.map((example, index) => (
            <button
              key={index}
              onClick={() => setPrompt(example.text)}
              className="text-left p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
            >
              <span className="text-2xl mr-3">{example.icon}</span>
              <span className="text-sm">{example.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* What You Get */}
      <div className="card bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-primary-200 dark:border-primary-800">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary-600" />
          What You'll Get
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <FileCode className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-medium text-sm">Smart Contract</p>
              <p className="text-xs text-gray-500">Solidity code</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Layout className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium text-sm">HTML Structure</p>
              <p className="text-xs text-gray-500">Responsive UI</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Palette className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <p className="font-medium text-sm">CSS Styles</p>
              <p className="text-xs text-gray-500">Modern design</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Code className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="font-medium text-sm">JavaScript</p>
              <p className="text-xs text-gray-500">Web3 integration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export for tutorial-style usage
export function Lightbulb(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}
