/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Excellence is a habit, not an act 🌟
 */

import FullStackPlayground from '@/components/Playground/FullStackPlayground';

const files = [
  {
    id: 'contract',
    name: 'NFTMinter.sol',
    language: 'solidity',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMinter is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.01 ether;
    
    event NFTMinted(address indexed to, uint256 indexed tokenId);
    
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}
    
    function mint(address to, string memory uri) public payable returns (uint256) {
        require(_tokenIds < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, uri);
        
        emit NFTMinted(to, newTokenId);
        return newTokenId;
    }
    
    function totalSupply() public view returns (uint256) {
        return _tokenIds;
    }
    
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
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
}`
  },
  {
    id: 'html',
    name: 'index.html',
    language: 'html',
    code: `<div class="app">
  <div class="card">
    <div class="header">
      <h1>🎨 NFT Minter</h1>
      <p>Create and mint your own NFTs</p>
    </div>
    
    <div class="status-bar">
      <div class="status-item">
        <span class="label">Contract</span>
        <span id="contractStatus" class="value pending">Not Deployed</span>
      </div>
      <div class="status-item">
        <span class="label">Total Minted</span>
        <span id="totalMinted" class="value">0 / 10,000</span>
      </div>
    </div>
    
    <div class="mint-form">
      <div class="form-group">
        <label>NFT Name</label>
        <input type="text" id="nftName" placeholder="My Awesome NFT" />
      </div>
      
      <div class="form-group">
        <label>Description</label>
        <textarea id="nftDesc" placeholder="Describe your NFT..." rows="3"></textarea>
      </div>
      
      <div class="form-group">
        <label>Image URL</label>
        <input type="text" id="imageUrl" placeholder="https://..." />
      </div>
      
      <div id="preview" class="preview" style="display: none;">
        <img id="previewImg" src="" alt="Preview" />
      </div>
      
      <div class="price-info">
        <span>Mint Price:</span>
        <span class="price">0.01 ETH</span>
      </div>
      
      <button id="mintBtn" class="mint-btn" disabled>
        Deploy Contract First
      </button>
      
      <div id="result" class="result" style="display: none;"></div>
    </div>
    
    <div class="minted-nfts">
      <h3>Your NFTs</h3>
      <div id="nftGrid" class="nft-grid">
        <div class="empty-state">Mint your first NFT!</div>
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
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
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

.header h1 {
  font-size: 28px;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header p {
  color: #94a3b8;
  margin: 0;
}

.status-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.status-item {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 12px;
  text-align: center;
}

.status-item .label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.status-item .value {
  font-weight: 600;
  font-size: 14px;
}

.status-item .value.pending {
  color: #fbbf24;
}

.status-item .value.ready {
  color: #4ade80;
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

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: white;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.preview {
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}

.preview img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.price-info {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
}

.price-info .price {
  font-weight: 700;
  color: #667eea;
}

.mint-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.mint-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
}

.mint-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.result.success {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

.result.error {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.minted-nfts {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.minted-nfts h3 {
  font-size: 16px;
  margin: 0 0 16px 0;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.nft-card {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  overflow: hidden;
}

.nft-card img {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.nft-card .nft-info {
  padding: 8px;
}

.nft-card .nft-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nft-card .nft-id {
  font-size: 10px;
  color: #94a3b8;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 14px;
}`
  },
  {
    id: 'javascript',
    name: 'app.js',
    language: 'javascript',
    code: `// DOM Elements
const contractStatus = document.getElementById('contractStatus');
const totalMinted = document.getElementById('totalMinted');
const nftName = document.getElementById('nftName');
const nftDesc = document.getElementById('nftDesc');
const imageUrl = document.getElementById('imageUrl');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const mintBtn = document.getElementById('mintBtn');
const result = document.getElementById('result');
const nftGrid = document.getElementById('nftGrid');

// State
let mintedNFTs = [];
let tokenId = 0;

// Check if contract is deployed (set by parent)
function checkDeployment() {
  if (window.IS_DEPLOYED && window.CONTRACT_ADDRESS) {
    contractStatus.textContent = window.CONTRACT_ADDRESS.slice(0, 6) + '...' + window.CONTRACT_ADDRESS.slice(-4);
    contractStatus.className = 'value ready';
    mintBtn.disabled = false;
    mintBtn.textContent = 'Mint NFT (0.01 ETH)';
  }
  
  // Update from contract state
  if (window.CONTRACT_STATE) {
    const supply = window.CONTRACT_STATE.totalSupply || 0;
    totalMinted.textContent = supply.toLocaleString() + ' / 10,000';
  }
}

// Image preview
imageUrl.addEventListener('input', () => {
  const url = imageUrl.value;
  if (url) {
    previewImg.src = url;
    preview.style.display = 'block';
    previewImg.onerror = () => {
      preview.style.display = 'none';
    };
  } else {
    preview.style.display = 'none';
  }
});

// Mint NFT
mintBtn.addEventListener('click', async () => {
  const name = nftName.value.trim();
  const desc = nftDesc.value.trim();
  const image = imageUrl.value.trim();
  
  if (!name) {
    showResult('Please enter an NFT name', 'error');
    return;
  }
  
  mintBtn.disabled = true;
  mintBtn.textContent = 'Minting...';
  
  // Simulate minting delay
  await new Promise(r => setTimeout(r, 1500));
  
  tokenId++;
  
  // Create NFT
  const nft = {
    id: tokenId,
    name: name,
    description: desc,
    image: image || 'https://picsum.photos/200?random=' + tokenId
  };
  
  mintedNFTs.push(nft);
  
  // Update UI
  showResult('🎉 Successfully minted ' + name + ' (Token #' + tokenId + ')', 'success');
  updateNFTGrid();
  
  // Reset form
  nftName.value = '';
  nftDesc.value = '';
  imageUrl.value = '';
  preview.style.display = 'none';
  
  mintBtn.disabled = false;
  mintBtn.textContent = 'Mint NFT (0.01 ETH)';
  
  // Log to console
  console.log('NFT Minted:', nft);
});

function showResult(message, type) {
  result.textContent = message;
  result.className = 'result ' + type;
  result.style.display = 'block';
  setTimeout(() => {
    result.style.display = 'none';
  }, 5000);
}

function updateNFTGrid() {
  if (mintedNFTs.length === 0) {
    nftGrid.innerHTML = '<div class="empty-state">Mint your first NFT!</div>';
    return;
  }
  
  nftGrid.innerHTML = mintedNFTs.map(nft => \`
    <div class="nft-card">
      <img src="\${nft.image}" alt="\${nft.name}" onerror="this.src='https://picsum.photos/200?random=\${nft.id}'" />
      <div class="nft-info">
        <div class="nft-name">\${nft.name}</div>
        <div class="nft-id">#\${nft.id}</div>
      </div>
    </div>
  \`).join('');
  
  totalMinted.textContent = mintedNFTs.length.toLocaleString() + ' / 10,000';
}

// Initialize
checkDeployment();
setInterval(checkDeployment, 1000);

console.log('NFT Minter initialized');`
  }
];

const contractFunctions = [
  {
    name: 'mint',
    type: 'write' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'uri', type: 'string' }
    ]
  },
  {
    name: 'totalSupply',
    type: 'read' as const,
    inputs: [],
    outputs: ['uint256']
  },
  {
    name: 'balanceOf',
    type: 'read' as const,
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: ['uint256']
  },
  {
    name: 'setMintPrice',
    type: 'write' as const,
    inputs: [{ name: 'newPrice', type: 'uint256' }]
  }
];

export default function NFTMinterFullStack() {
  return (
    <FullStackPlayground
      title="NFT Minter dApp"
      description="Complete NFT minting application with ERC-721 smart contract and React frontend"
      difficulty="Intermediate"
      files={files}
      contractFunctions={contractFunctions}
      initialState={{ totalSupply: 0, balance: 0 }}
    />
  );
}
