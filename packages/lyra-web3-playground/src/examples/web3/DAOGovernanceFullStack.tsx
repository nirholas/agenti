/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Great things are built by great people like you 👏
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'DAO.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DAO
 * @dev Decentralized Autonomous Organization with proposal and voting system
 * @notice Create proposals and vote with governance tokens
 */
contract DAO is Ownable, ReentrancyGuard {
    IERC20 public governanceToken;
    
    enum ProposalState { Pending, Active, Succeeded, Defeated, Executed, Cancelled }
    
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool cancelled;
        bytes[] calldatas;
        address[] targets;
    }
    
    uint256 public proposalCount;
    uint256 public votingDelay = 1 days;
    uint256 public votingPeriod = 7 days;
    uint256 public proposalThreshold = 100000e18; // 100k tokens to propose
    uint256 public quorumVotes = 1000000e18;      // 1M votes needed
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public votePower;
    
    event ProposalCreated(uint256 indexed proposalId, address proposer, string title);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    
    constructor(address _governanceToken) Ownable(msg.sender) {
        governanceToken = IERC20(_governanceToken);
    }
    
    function propose(
        string memory title,
        string memory description,
        address[] memory targets,
        bytes[] memory calldatas
    ) external returns (uint256) {
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "Below proposal threshold"
        );
        
        proposalCount++;
        
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            proposer: msg.sender,
            title: title,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            startTime: block.timestamp + votingDelay,
            endTime: block.timestamp + votingDelay + votingPeriod,
            executed: false,
            cancelled: false,
            calldatas: calldatas,
            targets: targets
        });
        
        emit ProposalCreated(proposalCount, msg.sender, title);
        return proposalCount;
    }
    
    function castVote(uint256 proposalId, uint8 support) external {
        require(state(proposalId) == ProposalState.Active, "Voting not active");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        
        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");
        
        Proposal storage proposal = proposals[proposalId];
        hasVoted[proposalId][msg.sender] = true;
        votePower[proposalId][msg.sender] = weight;
        
        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }
        
        emit VoteCast(msg.sender, proposalId, support, weight);
    }
    
    function execute(uint256 proposalId) external nonReentrant {
        require(state(proposalId) == ProposalState.Succeeded, "Not succeeded");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        
        for (uint i = 0; i < proposal.targets.length; i++) {
            (bool success,) = proposal.targets[i].call(proposal.calldatas[i]);
            require(success, "Execution failed");
        }
        
        emit ProposalExecuted(proposalId);
    }
    
    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Not authorized"
        );
        require(!proposal.executed, "Already executed");
        
        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }
    
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal memory proposal = proposals[proposalId];
        
        if (proposal.cancelled) return ProposalState.Cancelled;
        if (proposal.executed) return ProposalState.Executed;
        if (block.timestamp < proposal.startTime) return ProposalState.Pending;
        if (block.timestamp <= proposal.endTime) return ProposalState.Active;
        
        if (proposal.forVotes > proposal.againstVotes && 
            proposal.forVotes + proposal.abstainVotes >= quorumVotes) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory title,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 startTime,
        uint256 endTime,
        ProposalState currentState
    ) {
        Proposal memory p = proposals[proposalId];
        return (
            p.proposer,
            p.title,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.startTime,
            p.endTime,
            state(proposalId)
        );
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
      <h1>🏛️ DAO Governance</h1>
      <p>Decentralized decision-making for the community</p>
    </div>
    
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-value" id="votingPower">0</span>
        <span class="stat-label">Your Voting Power</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="activeProposals">0</span>
        <span class="stat-label">Active Proposals</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="totalMembers">0</span>
        <span class="stat-label">DAO Members</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="treasury">$0</span>
        <span class="stat-label">Treasury</span>
      </div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="switchTab('active')">Active</button>
      <button class="tab" onclick="switchTab('pending')">Pending</button>
      <button class="tab" onclick="switchTab('closed')">Closed</button>
      <button class="tab" onclick="switchTab('create')">+ Create</button>
    </div>
    
    <div id="activeTab" class="tab-content active">
      <div id="activeProposalsList" class="proposals-list"></div>
    </div>
    
    <div id="pendingTab" class="tab-content">
      <div id="pendingProposalsList" class="proposals-list"></div>
    </div>
    
    <div id="closedTab" class="tab-content">
      <div id="closedProposalsList" class="proposals-list"></div>
    </div>
    
    <div id="createTab" class="tab-content">
      <div class="create-form">
        <h2>Create Proposal</h2>
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="proposalTitle" placeholder="Enter proposal title" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="proposalDesc" rows="4" placeholder="Describe your proposal..."></textarea>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="proposalCategory">
            <option value="treasury">Treasury</option>
            <option value="governance">Governance</option>
            <option value="development">Development</option>
            <option value="community">Community</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="createProposal()">Submit Proposal</button>
      </div>
    </div>
  </div>
</div>

<!-- Vote Modal -->
<div id="voteModal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="voteModalTitle">Cast Vote</h3>
      <button onclick="closeVoteModal()" class="close-btn">&times;</button>
    </div>
    <div class="modal-body">
      <div id="proposalDetails" class="proposal-details"></div>
      <div class="vote-options">
        <button class="vote-btn vote-for" onclick="castVote(1)">
          <span class="vote-icon">👍</span>
          <span>For</span>
        </button>
        <button class="vote-btn vote-against" onclick="castVote(0)">
          <span class="vote-icon">👎</span>
          <span>Against</span>
        </button>
        <button class="vote-btn vote-abstain" onclick="castVote(2)">
          <span class="vote-icon">🤷</span>
          <span>Abstain</span>
        </button>
      </div>
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
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
  min-height: 100vh;
  color: #ffffff;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

.card {
  background: rgba(255, 255, 255, 0.06);
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
  background: linear-gradient(135deg, #a5b4fc, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #a5b4fc;
  font-size: 1.1rem;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #c4b5fd;
}

.stat-label {
  font-size: 0.85rem;
  color: #a5b4fc;
}

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
  padding: 12px;
  border: none;
  background: transparent;
  color: #a5b4fc;
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

.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proposal-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.proposal-card:hover {
  border-color: #8b5cf6;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.proposal-info {
  flex: 1;
}

.proposal-id {
  font-size: 0.8rem;
  color: #a5b4fc;
  margin-bottom: 4px;
}

.proposal-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.proposal-meta {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #a5b4fc;
}

.proposal-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.status-pending { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.status-succeeded { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
.status-defeated { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.status-executed { background: rgba(16, 185, 129, 0.3); color: #34d399; }

.vote-progress {
  margin-bottom: 16px;
}

.vote-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  margin-bottom: 8px;
}

.vote-for-bar {
  background: #10b981;
  transition: width 0.3s;
}

.vote-against-bar {
  background: #ef4444;
  transition: width 0.3s;
}

.vote-counts {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.vote-count-for { color: #10b981; }
.vote-count-against { color: #ef4444; }

.proposal-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.create-form {
  max-width: 600px;
  margin: 0 auto;
}

.create-form h2 {
  margin-bottom: 24px;
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #a5b4fc;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  color: white;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
}

/* Vote Modal */
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
  background: #312e81;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  border: 1px solid rgba(255, 255, 255, 0.15);
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
  color: #a5b4fc;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
}

.proposal-details {
  background: rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.vote-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.vote-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.vote-btn:hover {
  transform: scale(1.05);
}

.vote-for:hover { border-color: #10b981; background: rgba(16, 185, 129, 0.2); }
.vote-against:hover { border-color: #ef4444; background: rgba(239, 68, 68, 0.2); }
.vote-abstain:hover { border-color: #f59e0b; background: rgba(245, 158, 11, 0.2); }

.vote-icon {
  font-size: 2rem;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6366f1;
}`
  },
  {
    id: 'js',
    name: 'app.js',
    language: 'javascript',
    code: `// DAO Governance Application

const state = {
  votingPower: 50000,
  proposals: [
    {
      id: 1,
      title: 'Increase Treasury Allocation for Development',
      description: 'Proposal to allocate 500,000 tokens from treasury for Q1 2024 development initiatives.',
      proposer: '0x1234...abcd',
      category: 'treasury',
      forVotes: 1250000,
      againstVotes: 320000,
      abstainVotes: 50000,
      status: 'active',
      startTime: Date.now() - 86400000 * 2,
      endTime: Date.now() + 86400000 * 5,
      hasVoted: false
    },
    {
      id: 2,
      title: 'Add New Governance Token Utility',
      description: 'Introduce staking rewards for governance token holders who actively participate in voting.',
      proposer: '0x5678...efgh',
      category: 'governance',
      forVotes: 890000,
      againstVotes: 150000,
      abstainVotes: 30000,
      status: 'active',
      startTime: Date.now() - 86400000,
      endTime: Date.now() + 86400000 * 6,
      hasVoted: false
    },
    {
      id: 3,
      title: 'Community Grant Program',
      description: 'Establish a 100,000 token grant pool for community builders and developers.',
      proposer: '0x9abc...ijkl',
      category: 'community',
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      status: 'pending',
      startTime: Date.now() + 86400000,
      endTime: Date.now() + 86400000 * 8,
      hasVoted: false
    },
    {
      id: 4,
      title: 'Protocol Fee Reduction',
      description: 'Reduce protocol fees from 0.3% to 0.2% to increase competitiveness.',
      proposer: '0xdef0...mnop',
      category: 'governance',
      forVotes: 2100000,
      againstVotes: 450000,
      abstainVotes: 100000,
      status: 'succeeded',
      startTime: Date.now() - 86400000 * 10,
      endTime: Date.now() - 86400000 * 3,
      hasVoted: true,
      userVote: 1
    },
    {
      id: 5,
      title: 'Marketing Budget Q4',
      description: 'Allocate 200,000 tokens for Q4 marketing campaigns.',
      proposer: '0x1122...qrst',
      category: 'treasury',
      forVotes: 300000,
      againstVotes: 850000,
      abstainVotes: 50000,
      status: 'defeated',
      startTime: Date.now() - 86400000 * 14,
      endTime: Date.now() - 86400000 * 7,
      hasVoted: true,
      userVote: 0
    }
  ],
  selectedProposal: null
};

// Format numbers
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Format time remaining
function formatTimeRemaining(endTime) {
  const diff = endTime - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? \`\${days}d \${hours}h left\` : \`\${hours}h left\`;
}

// Get status class
function getStatusClass(status) {
  const classes = {
    active: 'status-active',
    pending: 'status-pending',
    succeeded: 'status-succeeded',
    defeated: 'status-defeated',
    executed: 'status-executed'
  };
  return classes[status] || '';
}

// Update stats
function updateStats() {
  const active = state.proposals.filter(p => p.status === 'active').length;
  
  document.getElementById('votingPower').textContent = formatNumber(state.votingPower);
  document.getElementById('activeProposals').textContent = active;
  document.getElementById('totalMembers').textContent = '12,458';
  document.getElementById('treasury').textContent = '$4.2M';
}

// Render proposal card
function renderProposalCard(proposal) {
  const totalVotes = proposal.forVotes + proposal.againstVotes;
  const forPercent = totalVotes > 0 ? (proposal.forVotes / totalVotes * 100) : 50;
  const againstPercent = totalVotes > 0 ? (proposal.againstVotes / totalVotes * 100) : 50;
  
  return \`
    <div class="proposal-card">
      <div class="proposal-header">
        <div class="proposal-info">
          <div class="proposal-id">Proposal #\${proposal.id}</div>
          <div class="proposal-title">\${proposal.title}</div>
          <div class="proposal-meta">
            <span>By \${proposal.proposer}</span>
            <span>•</span>
            <span>\${formatTimeRemaining(proposal.endTime)}</span>
          </div>
        </div>
        <span class="proposal-status \${getStatusClass(proposal.status)}">
          \${proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
        </span>
      </div>
      
      <div class="vote-progress">
        <div class="vote-bar">
          <div class="vote-for-bar" style="width: \${forPercent}%"></div>
          <div class="vote-against-bar" style="width: \${againstPercent}%"></div>
        </div>
        <div class="vote-counts">
          <span class="vote-count-for">For: \${formatNumber(proposal.forVotes)}</span>
          <span class="vote-count-against">Against: \${formatNumber(proposal.againstVotes)}</span>
        </div>
      </div>
      
      <div class="proposal-actions">
        \${proposal.status === 'active' && !proposal.hasVoted ? 
          \`<button class="btn btn-primary" onclick="openVoteModal(\${proposal.id})">Cast Vote</button>\` :
          proposal.hasVoted ? 
          \`<button class="btn btn-secondary" disabled>Voted \${proposal.userVote === 1 ? 'For' : proposal.userVote === 0 ? 'Against' : 'Abstain'}</button>\` :
          \`<button class="btn btn-secondary" onclick="viewDetails(\${proposal.id})">View Details</button>\`
        }
        \${proposal.status === 'succeeded' ? 
          \`<button class="btn btn-primary" onclick="executeProposal(\${proposal.id})">Execute</button>\` : ''
        }
      </div>
    </div>
  \`;
}

// Render proposals by status
function renderProposals() {
  const active = state.proposals.filter(p => p.status === 'active');
  const pending = state.proposals.filter(p => p.status === 'pending');
  const closed = state.proposals.filter(p => ['succeeded', 'defeated', 'executed'].includes(p.status));
  
  document.getElementById('activeProposalsList').innerHTML = 
    active.length > 0 ? active.map(renderProposalCard).join('') : 
    '<div class="empty-state">No active proposals</div>';
    
  document.getElementById('pendingProposalsList').innerHTML = 
    pending.length > 0 ? pending.map(renderProposalCard).join('') : 
    '<div class="empty-state">No pending proposals</div>';
    
  document.getElementById('closedProposalsList').innerHTML = 
    closed.length > 0 ? closed.map(renderProposalCard).join('') : 
    '<div class="empty-state">No closed proposals</div>';
}

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  
  const tabs = ['active', 'pending', 'closed', 'create'];
  const idx = tabs.indexOf(tab);
  document.querySelector(\`.tab:nth-child(\${idx + 1})\`).classList.add('active');
  document.getElementById(tab + 'Tab').classList.add('active');
}

// Vote modal
function openVoteModal(proposalId) {
  state.selectedProposal = proposalId;
  const proposal = state.proposals.find(p => p.id === proposalId);
  
  document.getElementById('voteModalTitle').textContent = 'Vote on Proposal #' + proposalId;
  document.getElementById('proposalDetails').innerHTML = \`
    <h4>\${proposal.title}</h4>
    <p style="color: #a5b4fc; margin-top: 8px;">\${proposal.description}</p>
    <p style="margin-top: 12px;">Your voting power: <strong>\${formatNumber(state.votingPower)}</strong></p>
  \`;
  
  document.getElementById('voteModal').style.display = 'flex';
  console.log(\`[UI] Opened vote modal for proposal #\${proposalId}\`);
}

function closeVoteModal() {
  document.getElementById('voteModal').style.display = 'none';
  state.selectedProposal = null;
}

// Cast vote
function castVote(support) {
  const proposal = state.proposals.find(p => p.id === state.selectedProposal);
  if (!proposal) return;
  
  const voteTypes = ['Against', 'For', 'Abstain'];
  
  if (support === 1) proposal.forVotes += state.votingPower;
  else if (support === 0) proposal.againstVotes += state.votingPower;
  else proposal.abstainVotes += state.votingPower;
  
  proposal.hasVoted = true;
  proposal.userVote = support;
  
  console.log(\`[TX] Voted \${voteTypes[support]} on proposal #\${proposal.id}\`);
  console.log(\`[CONTRACT] DAO.castVote(\${proposal.id}, \${support})\`);
  
  closeVoteModal();
  renderProposals();
  updateStats();
}

// Create proposal
function createProposal() {
  const title = document.getElementById('proposalTitle').value;
  const description = document.getElementById('proposalDesc').value;
  const category = document.getElementById('proposalCategory').value;
  
  if (!title || !description) {
    console.error('[ERROR] Please fill in all fields');
    return;
  }
  
  if (state.votingPower < 100000) {
    console.error('[ERROR] Need 100K voting power to create proposals');
    return;
  }
  
  const newProposal = {
    id: state.proposals.length + 1,
    title,
    description,
    proposer: '0xYour...Addr',
    category,
    forVotes: 0,
    againstVotes: 0,
    abstainVotes: 0,
    status: 'pending',
    startTime: Date.now() + 86400000,
    endTime: Date.now() + 86400000 * 8,
    hasVoted: false
  };
  
  state.proposals.push(newProposal);
  
  console.log(\`[TX] Created proposal #\${newProposal.id}: "\${title}"\`);
  console.log(\`[CONTRACT] DAO.propose("\${title}", "\${description}", [], [])\`);
  
  document.getElementById('proposalTitle').value = '';
  document.getElementById('proposalDesc').value = '';
  
  switchTab('pending');
  renderProposals();
  updateStats();
}

// Execute proposal
function executeProposal(proposalId) {
  const proposal = state.proposals.find(p => p.id === proposalId);
  if (!proposal) return;
  
  proposal.status = 'executed';
  
  console.log(\`[TX] Executed proposal #\${proposalId}\`);
  console.log(\`[CONTRACT] DAO.execute(\${proposalId})\`);
  
  renderProposals();
}

// Initialize
renderProposals();
updateStats();

console.log('[INIT] DAO Governance dApp initialized');
console.log('[INFO] You have 50,000 voting power');`
  }
];

const contractFunctions = [
  {
    name: 'propose',
    type: 'write' as const,
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'targets', type: 'address[]' },
      { name: 'calldatas', type: 'bytes[]' }
    ]
  },
  {
    name: 'castVote',
    type: 'write' as const,
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' }
    ]
  },
  {
    name: 'execute',
    type: 'write' as const,
    inputs: [
      { name: 'proposalId', type: 'uint256' }
    ]
  },
  {
    name: 'cancel',
    type: 'write' as const,
    inputs: [
      { name: 'proposalId', type: 'uint256' }
    ]
  },
  {
    name: 'state',
    type: 'read' as const,
    inputs: [
      { name: 'proposalId', type: 'uint256' }
    ]
  },
  {
    name: 'getProposal',
    type: 'read' as const,
    inputs: [
      { name: 'proposalId', type: 'uint256' }
    ]
  },
  {
    name: 'proposalCount',
    type: 'read' as const,
    inputs: []
  }
];

export default function DAOGovernanceFullStack() {
  return (
    <FullStackPlayground
      difficulty="Advanced"
      files={files}
      contractFunctions={contractFunctions}
      title="DAO Governance"
      description="Create proposals, vote on decisions, and execute governance actions with token-based voting power"
    />
  );
}
