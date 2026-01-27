/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Building something beautiful, one line at a time
 */

import { Tutorial } from '@/components/Tutorial/InteractiveTutorial';

export const tutorials: Tutorial[] = [
  {
    id: 'wallet-connect-tutorial',
    title: 'Connect to Web3 Wallets',
    description: 'Learn how to integrate MetaMask and other Web3 wallets into your dApp',
    category: 'basics',
    difficulty: 'beginner',
    estimatedTime: '15 min',
    prerequisites: ['Basic JavaScript knowledge'],
    languages: ['javascript', 'typescript', 'react'],
    steps: [
      {
        id: 'step-1',
        title: 'Detect Wallet Provider',
        description: 'First, we need to check if the user has a Web3 wallet installed in their browser.',
        explanation: 'The window.ethereum object is injected by wallet extensions like MetaMask. We check for its presence before attempting to connect.',
        code: {
          javascript: `// Check if MetaMask is installed
if (typeof window.ethereum !== 'undefined') {
  console.log('MetaMask is installed!');
  const provider = window.ethereum;
} else {
  console.log('Please install MetaMask!');
  alert('Please install MetaMask to use this dApp');
}`,
          typescript: `// Check if MetaMask is installed with TypeScript
interface Ethereum extends EventEmitter {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

declare global {
  interface Window {
    ethereum?: Ethereum;
  }
}

if (typeof window.ethereum !== 'undefined') {
  console.log('MetaMask is installed!');
  const provider: Ethereum = window.ethereum;
} else {
  console.log('Please install MetaMask!');
  alert('Please install MetaMask to use this dApp');
}`,
          react: `import { useState, useEffect } from 'react';

function WalletDetector() {
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      console.log('MetaMask is installed!');
      setHasWallet(true);
    }
  }, []);

  return (
    <div>
      {hasWallet ? (
        <p>✅ Wallet detected!</p>
      ) : (
        <p>❌ Please install MetaMask</p>
      )}
    </div>
  );
}

export default WalletDetector;`
        },
        expectedOutput: 'MetaMask is installed!\n✅ Wallet provider detected',
        hints: [
          'The window.ethereum object is only available after the page loads',
          'Always check for undefined before accessing wallet properties'
        ]
      },
      {
        id: 'step-2',
        title: 'Request Account Access',
        description: 'Request permission to access the user\'s wallet accounts.',
        explanation: 'eth_requestAccounts prompts the user to connect their wallet. This is a one-time permission request that returns an array of account addresses.',
        code: {
          javascript: `async function connectWallet() {
  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    
    const account = accounts[0];
    console.log('Connected account:', account);
    return account;
  } catch (error) {
    console.error('User rejected connection:', error);
    throw error;
  }
}

// Call the function
connectWallet()
  .then(account => console.log('Success!', account))
  .catch(err => console.error('Failed:', err));`,
          typescript: `async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    }) as string[];
    
    const account = accounts[0];
    console.log('Connected account:', account);
    return account;
  } catch (error) {
    console.error('User rejected connection:', error);
    throw error;
  }
}

// Call the function
connectWallet()
  .then(account => console.log('Success!', account))
  .catch(err => console.error('Failed:', err));`,
          react: `import { useState } from 'react';

function WalletConnect() {
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      setAccount(accounts[0]);
    } catch (err) {
      setError('User rejected connection');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!account ? (
        <button 
          onClick={connectWallet}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default WalletConnect;`
        },
        expectedOutput: 'Connected account: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\nSuccess!',
        hints: [
          'The method returns an array, so access the first element',
          'Always wrap in try-catch to handle user rejections',
          'Store the account address in state for later use'
        ],
        challenge: {
          prompt: 'Add a disconnect function that clears the account and shows a "Connect Wallet" button again.',
          solution: `import { useState } from 'react';

function WalletConnect() {
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) return;
    setLoading(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      setAccount(accounts[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
  };

  return (
    <div>
      {!account ? (
        <button onClick={connectWallet} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div>
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
          <button onClick={disconnectWallet}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

export default WalletConnect;`,
          hints: [
            'Create a new function that sets account to null',
            'Add a disconnect button that only shows when connected'
          ]
        }
      },
      {
        id: 'step-3',
        title: 'Handle Network Changes',
        description: 'Listen for network and account changes to keep your dApp in sync.',
        explanation: 'Wallets can change networks or accounts. We listen to these events to update our UI accordingly.',
        code: {
          javascript: `// Listen for account changes
window.ethereum.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    console.log('Wallet disconnected');
  } else {
    console.log('Account changed to:', accounts[0]);
  }
});

// Listen for network changes
window.ethereum.on('chainChanged', (chainId) => {
  console.log('Network changed to:', chainId);
  // Reload the page to avoid state issues
  window.location.reload();
});

// Get current network
const chainId = await window.ethereum.request({ 
  method: 'eth_chainId' 
});
console.log('Current network:', chainId);`,
          typescript: `// Listen for account changes
window.ethereum?.on('accountsChanged', (accounts: string[]) => {
  if (accounts.length === 0) {
    console.log('Wallet disconnected');
  } else {
    console.log('Account changed to:', accounts[0]);
  }
});

// Listen for network changes
window.ethereum?.on('chainChanged', (chainId: string) => {
  console.log('Network changed to:', chainId);
  // Reload the page to avoid state issues
  window.location.reload();
});

// Get current network
const chainId = await window.ethereum?.request({ 
  method: 'eth_chainId' 
}) as string;
console.log('Current network:', chainId);`,
          react: `import { useState, useEffect } from 'react';

function WalletWithEvents() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ethereum) return;

    // Get initial network
    window.ethereum.request({ method: 'eth_chainId' })
      .then((id: string) => setChainId(id));

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
      } else {
        setAccount(accounts[0]);
      }
    };

    // Listen for network changes
    const handleChainChanged = (newChainId: string) => {
      setChainId(newChainId);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup listeners
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  return (
    <div>
      <p>Account: {account || 'Not connected'}</p>
      <p>Network: {chainId || 'Unknown'}</p>
    </div>
  );
}

export default WalletWithEvents;`
        },
        expectedOutput: 'Account changed to: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\nCurrent network: 0x1',
        hints: [
          'Always clean up event listeners in useEffect return',
          'Network IDs are returned in hexadecimal format (0x1 = Ethereum Mainnet)',
          'Consider reloading the page on network changes to avoid state issues'
        ]
      },
      {
        id: 'step-4',
        title: 'Get Account Balance',
        description: 'Fetch and display the user\'s ETH balance.',
        explanation: 'We use eth_getBalance to query the blockchain for an account\'s balance. The result is in Wei, so we convert it to ETH.',
        code: {
          javascript: `async function getBalance(account) {
  try {
    // Get balance in Wei
    const balanceWei = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [account, 'latest']
    });
    
    // Convert from Wei to ETH (1 ETH = 10^18 Wei)
    const balanceEth = parseInt(balanceWei, 16) / 1e18;
    
    console.log('Balance:', balanceEth, 'ETH');
    return balanceEth;
  } catch (error) {
    console.error('Failed to get balance:', error);
  }
}

// Usage
const account = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
getBalance(account);`,
          typescript: `import { ethers } from 'ethers';

async function getBalance(account: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    // Using ethers.js for easier conversion
    const provider = new ethers.BrowserProvider(window.ethereum);
    const balance = await provider.getBalance(account);
    
    // Format to ETH with 4 decimal places
    const balanceEth = ethers.formatEther(balance);
    
    console.log('Balance:', balanceEth, 'ETH');
    return balanceEth;
  } catch (error) {
    console.error('Failed to get balance:', error);
    throw error;
  }
}

// Usage
const account = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
getBalance(account);`,
          react: `import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function WalletBalance({ account }: { account: string | null }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account || !window.ethereum) return;

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(account);
        setBalance(ethers.formatEther(balance));
      } catch (error) {
        console.error('Failed to get balance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [account]);

  if (!account) return null;

  return (
    <div>
      <p>Balance: {loading ? 'Loading...' : \`\${balance} ETH\`}</p>
    </div>
  );
}

export default WalletBalance;`
        },
        expectedOutput: 'Balance: 1.2345 ETH',
        hints: [
          'Balance is returned in Wei (smallest unit)',
          'Use ethers.js formatEther() for easy conversion',
          'Consider refreshing balance periodically'
        ],
        challenge: {
          prompt: 'Add a refresh button that manually updates the balance when clicked.',
          solution: `import { useState } from 'react';
import { ethers } from 'ethers';

function WalletBalance({ account }: { account: string | null }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = async () => {
    if (!account || !window.ethereum) return;
    
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(account);
      setBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Failed to get balance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p>Balance: {balance ? \`\${balance} ETH\` : 'Not fetched'}</p>
      <button onClick={fetchBalance} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh Balance'}
      </button>
    </div>
  );
}

export default WalletBalance;`,
          hints: [
            'Move fetchBalance outside useEffect so it can be called manually',
            'Add a button with onClick handler'
          ]
        }
      }
    ]
  },
  {
    id: 'nft-minting-tutorial',
    title: 'Create & Mint Your First NFT',
    description: 'Build a complete NFT minting dApp with smart contract and frontend',
    category: 'nft',
    difficulty: 'intermediate',
    estimatedTime: '30 min',
    prerequisites: ['Basic Solidity', 'ERC-721 standard knowledge'],
    languages: ['solidity', 'typescript', 'react'],
    steps: [
      {
        id: 'nft-step-1',
        title: 'Create NFT Smart Contract',
        description: 'Write an ERC-721 NFT contract with minting functionality.',
        explanation: 'We use OpenZeppelin\'s ERC721 implementation for standards compliance. ERC721URIStorage allows us to set metadata URIs for each token.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    uint256 public mintPrice = 0.01 ether;
    uint256 public maxSupply = 10000;

    event NFTMinted(address indexed minter, uint256 indexed tokenId);

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function mint(string memory uri) public payable returns (uint256) {
        require(_tokenIdCounter < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(msg.sender, tokenId);
        return tokenId;
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}`,
          typescript: `// TypeScript types for NFT contract
interface NFTContract {
  mint(uri: string, options: { value: bigint }): Promise<any>;
  totalSupply(): Promise<bigint>;
  mintPrice(): Promise<bigint>;
  maxSupply(): Promise<bigint>;
  tokenURI(tokenId: bigint): Promise<string>;
  balanceOf(owner: string): Promise<bigint>;
}

// Contract ABI (simplified)
const NFT_ABI = [
  "function mint(string uri) payable returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "event NFTMinted(address indexed minter, uint256 indexed tokenId)"
];

export { NFT_ABI, type NFTContract };`,
          react: `import { useState } from 'react';

function NFTContractDisplay() {
  const [showCode, setShowCode] = useState(true);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-bold mb-2">Key Features:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>ERC-721 standard compliance</li>
          <li>Configurable mint price (0.01 ETH)</li>
          <li>Max supply limit (10,000 NFTs)</li>
          <li>Metadata URI storage</li>
          <li>Owner withdrawal function</li>
          <li>Minting event emission</li>
        </ul>
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-sm">
          <strong>💡 Pro Tip:</strong> Always use OpenZeppelin contracts 
          for standards compliance and security audits.
        </p>
      </div>
    </div>
  );
}

export default NFTContractDisplay;`
        },
        expectedOutput: '✅ NFT Contract created successfully!\n\nKey features:\n- ERC-721 compliant\n- Mint price: 0.01 ETH\n- Max supply: 10,000',
        hints: [
          'OpenZeppelin provides battle-tested ERC-721 implementation',
          'Always include a max supply to prevent unlimited minting',
          'Use payable for functions that receive ETH'
        ]
      },
      {
        id: 'nft-step-2',
        title: 'Upload NFT Metadata to IPFS',
        description: 'Create and upload NFT metadata (image + JSON) to IPFS.',
        explanation: 'IPFS provides decentralized storage for NFT metadata. We upload the image first, then create a JSON metadata file that references it.',
        code: {
          typescript: `import { create } from 'ipfs-http-client';

// Initialize IPFS client
const ipfs = create({ 
  host: 'ipfs.infura.io', 
  port: 5001, 
  protocol: 'https' 
});

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

async function uploadToIPFS(file: File): Promise<string> {
  try {
    // Upload file to IPFS
    const added = await ipfs.add(file);
    const ipfsHash = added.path;
    const ipfsURL = \`https://ipfs.io/ipfs/\${ipfsHash}\`;
    
    console.log('File uploaded to IPFS:', ipfsURL);
    return ipfsURL;
  } catch (error) {
    console.error('IPFS upload failed:', error);
    throw error;
  }
}

async function createNFTMetadata(
  imageFile: File,
  name: string,
  description: string,
  attributes: NFTMetadata['attributes'] = []
): Promise<string> {
  // 1. Upload image to IPFS
  const imageURL = await uploadToIPFS(imageFile);
  
  // 2. Create metadata JSON
  const metadata: NFTMetadata = {
    name,
    description,
    image: imageURL,
    attributes
  };
  
  // 3. Upload metadata JSON to IPFS
  const metadataBlob = new Blob(
    [JSON.stringify(metadata, null, 2)], 
    { type: 'application/json' }
  );
  const metadataFile = new File([metadataBlob], 'metadata.json');
  const metadataURL = await uploadToIPFS(metadataFile);
  
  console.log('NFT metadata created:', metadataURL);
  return metadataURL;
}

export { uploadToIPFS, createNFTMetadata };`,
          javascript: `// Simple IPFS upload using Web3.Storage
async function uploadToWeb3Storage(file) {
  const token = 'YOUR_WEB3_STORAGE_TOKEN';
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`
    },
    body: formData
  });

  const data = await response.json();
  return \`https://\${data.cid}.ipfs.w3s.link\`;
}

async function createMetadata(imageFile, name, description) {
  // Upload image
  const imageURL = await uploadToWeb3Storage(imageFile);
  
  // Create metadata
  const metadata = {
    name: name,
    description: description,
    image: imageURL,
    attributes: [
      { trait_type: "Rarity", value: "Common" },
      { trait_type: "Level", value: "1" }
    ]
  };
  
  // Upload metadata
  const metadataBlob = new Blob([JSON.stringify(metadata)]);
  const metadataFile = new File([metadataBlob], 'metadata.json');
  const metadataURL = await uploadToWeb3Storage(metadataFile);
  
  return metadataURL;
}`,
          react: `import { useState } from 'react';

function IPFSUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    name: '',
    description: ''
  });
  const [ipfsURL, setIpfsURL] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      // Upload using your preferred IPFS service
      const url = await createNFTMetadata(
        file,
        metadata.name,
        metadata.description
      );
      setIpfsURL(url);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2">NFT Name</label>
        <input
          type="text"
          value={metadata.name}
          onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="Cool NFT #1"
        />
      </div>

      <div>
        <label className="block mb-2">Description</label>
        <textarea
          value={metadata.description}
          onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="Describe your NFT..."
          rows={3}
        />
      </div>

      <div>
        <label className="block mb-2">Image File</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || !metadata.name || uploading}
        className="btn-primary w-full"
      >
        {uploading ? 'Uploading to IPFS...' : 'Upload Metadata'}
      </button>

      {ipfsURL && (
        <div className="p-4 bg-green-50 rounded">
          <p className="font-semibold mb-2">✅ Upload successful!</p>
          <a 
            href={ipfsURL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 break-all"
          >
            {ipfsURL}
          </a>
        </div>
      )}
    </div>
  );
}

export default IPFSUploader;`
        },
        expectedOutput: '✅ Image uploaded to IPFS: https://ipfs.io/ipfs/Qm...\n✅ Metadata uploaded to IPFS: https://ipfs.io/ipfs/Qm...',
        hints: [
          'Always upload the image before creating the metadata JSON',
          'IPFS URLs use the format: ipfs://[CID] or https://ipfs.io/ipfs/[CID]',
          'Consider using pinning services like Pinata for permanent storage'
        ],
        challenge: {
          prompt: 'Add support for multiple attributes (traits) that users can define.',
          solution: `// Enhanced version with dynamic attributes
const [attributes, setAttributes] = useState<Array<{trait_type: string, value: string}>>([]);

const addAttribute = () => {
  setAttributes([...attributes, { trait_type: '', value: '' }]);
};

const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
  const updated = [...attributes];
  updated[index][field] = value;
  setAttributes(updated);
};

// In your upload function, pass attributes to createNFTMetadata`,
          hints: [
            'Use an array state to store multiple attribute objects',
            'Add +/- buttons to add or remove attributes'
          ]
        }
      }
    ]
  },
  {
    id: 'intro-web3',
    title: 'What is Web3?',
    description: 'A comprehensive introduction to Web3, blockchain technology, and the decentralized web',
    category: 'getting-started',
    difficulty: 'beginner',
    estimatedTime: '20 min',
    prerequisites: [],
    languages: ['javascript'],
    steps: [
      {
        id: 'intro-step-1',
        title: 'Understanding Web3',
        description: 'Learn the fundamental concepts behind Web3 and how it differs from Web2.',
        explanation: 'Web3 represents the next evolution of the internet, built on blockchain technology. Unlike Web2 where data is controlled by centralized companies, Web3 gives users ownership of their data and digital assets.',
        code: {
          javascript: `// Web3 vs Web2 Comparison
const web2 = {
  dataOwnership: 'Centralized platforms (Google, Facebook, Amazon)',
  identity: 'Username/password controlled by each platform',
  payments: 'Banks and payment processors as intermediaries',
  trust: 'Trust the platform',
  examples: ['Social media', 'Cloud storage', 'Online banking']
};

const web3 = {
  dataOwnership: 'Users own their data on the blockchain',
  identity: 'Self-sovereign identity via wallet addresses',
  payments: 'Peer-to-peer without intermediaries',
  trust: 'Trust the code (smart contracts)',
  examples: ['DeFi', 'NFTs', 'DAOs', 'dApps']
};

console.log('Web2:', web2);
console.log('Web3:', web3);`
        },
        expectedOutput: 'Web2: { dataOwnership: "Centralized platforms...", ... }\nWeb3: { dataOwnership: "Users own their data...", ... }',
        hints: [
          'Web3 is about decentralization and user ownership',
          'Blockchain provides the trust layer for Web3'
        ]
      },
      {
        id: 'intro-step-2',
        title: 'What is Blockchain?',
        description: 'Understand the technology that powers Web3.',
        explanation: 'A blockchain is a distributed ledger that records transactions across many computers. Once data is recorded, it cannot be altered, providing immutability and transparency.',
        code: {
          javascript: `// Simplified blockchain concept
class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    // In reality, this uses cryptographic hashing (SHA-256)
    return btoa(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data));
  }
}

// Create a simple chain
const genesisBlock = new Block(0, Date.now(), { message: 'Genesis Block' }, '0');
const block1 = new Block(1, Date.now(), { from: 'Alice', to: 'Bob', amount: 10 }, genesisBlock.hash);

console.log('Genesis Block:', genesisBlock);
console.log('Block 1:', block1);
console.log('Chain is valid:', block1.previousHash === genesisBlock.hash);`
        },
        expectedOutput: 'Genesis Block: Block { index: 0, ... }\nBlock 1: Block { index: 1, ... }\nChain is valid: true',
        hints: [
          'Each block contains a hash of the previous block',
          'This creates an immutable chain of data'
        ]
      },
      {
        id: 'intro-step-3',
        title: 'Smart Contracts',
        description: 'Learn about self-executing code on the blockchain.',
        explanation: 'Smart contracts are programs stored on the blockchain that run when predetermined conditions are met. They automate agreements and eliminate the need for intermediaries.',
        code: {
          javascript: `// Smart contract concept in JavaScript
class SimpleSmartContract {
  constructor() {
    this.balances = new Map();
  }

  // Deposit funds
  deposit(address, amount) {
    const current = this.balances.get(address) || 0;
    this.balances.set(address, current + amount);
    console.log(\`Deposited \${amount} to \${address}\`);
    return true;
  }

  // Transfer between accounts
  transfer(from, to, amount) {
    const fromBalance = this.balances.get(from) || 0;
    
    // This is like a require() statement in Solidity
    if (fromBalance < amount) {
      throw new Error('Insufficient balance');
    }
    
    this.balances.set(from, fromBalance - amount);
    this.balances.set(to, (this.balances.get(to) || 0) + amount);
    console.log(\`Transferred \${amount} from \${from} to \${to}\`);
    return true;
  }

  getBalance(address) {
    return this.balances.get(address) || 0;
  }
}

const contract = new SimpleSmartContract();
contract.deposit('Alice', 100);
contract.transfer('Alice', 'Bob', 30);
console.log('Alice balance:', contract.getBalance('Alice'));
console.log('Bob balance:', contract.getBalance('Bob'));`
        },
        expectedOutput: 'Deposited 100 to Alice\nTransferred 30 from Alice to Bob\nAlice balance: 70\nBob balance: 30',
        hints: [
          'Smart contracts enforce rules automatically',
          'Once deployed, contract code cannot be changed'
        ]
      },
      {
        id: 'intro-step-4',
        title: 'Key Web3 Concepts',
        description: 'Learn about wallets, tokens, and dApps.',
        explanation: 'Understanding wallets, tokens, and decentralized applications (dApps) is essential for navigating the Web3 ecosystem.',
        code: {
          javascript: `// Key Web3 concepts
const web3Concepts = {
  wallet: {
    description: 'A digital wallet that stores your private keys',
    examples: ['MetaMask', 'Coinbase Wallet', 'Ledger'],
    keyComponents: {
      publicKey: 'Your address - share this to receive funds',
      privateKey: 'NEVER share this - controls your assets',
      seedPhrase: '12-24 words to recover your wallet'
    }
  },
  
  tokens: {
    fungible: {
      standard: 'ERC-20',
      examples: ['USDC', 'LINK', 'UNI'],
      property: 'Each token is identical and interchangeable'
    },
    nonFungible: {
      standard: 'ERC-721',
      examples: ['CryptoPunks', 'Bored Apes', 'Art NFTs'],
      property: 'Each token is unique'
    }
  },
  
  dApps: {
    description: 'Decentralized applications running on blockchain',
    categories: ['DeFi', 'Gaming', 'Social', 'Marketplaces'],
    examples: ['Uniswap', 'OpenSea', 'Aave', 'ENS']
  }
};

console.log('Wallet:', web3Concepts.wallet);
console.log('Tokens:', web3Concepts.tokens);
console.log('dApps:', web3Concepts.dApps);`
        },
        expectedOutput: 'Wallet: { description: "A digital wallet...", ... }\nTokens: { fungible: {...}, nonFungible: {...} }\ndApps: { description: "Decentralized applications...", ... }',
        hints: [
          'Never share your private key or seed phrase',
          'dApps connect to blockchain through your wallet'
        ]
      },
      {
        id: 'intro-step-5',
        title: 'The Ethereum Network',
        description: 'Understand Ethereum, the leading smart contract platform.',
        explanation: 'Ethereum is the most widely used blockchain for smart contracts and dApps. It introduced the concept of programmable money and decentralized applications.',
        code: {
          javascript: `// Ethereum network basics
const ethereum = {
  name: 'Ethereum',
  symbol: 'ETH',
  type: 'Smart Contract Platform',
  
  networks: {
    mainnet: {
      chainId: 1,
      description: 'Production network with real value',
      explorer: 'https://etherscan.io'
    },
    sepolia: {
      chainId: 11155111,
      description: 'Test network for development',
      explorer: 'https://sepolia.etherscan.io'
    }
  },
  
  gas: {
    description: 'Fee paid to execute transactions',
    unit: 'Gwei (1 Gwei = 0.000000001 ETH)',
    factors: ['Network congestion', 'Transaction complexity']
  },
  
  consensus: {
    mechanism: 'Proof of Stake (PoS)',
    validators: 'Stake ETH to validate transactions',
    rewards: 'Earn ETH for honest validation'
  }
};

console.log('Ethereum Overview:', ethereum.name, '-', ethereum.type);
console.log('Mainnet Chain ID:', ethereum.networks.mainnet.chainId);
console.log('Gas:', ethereum.gas.description);
console.log('Consensus:', ethereum.consensus.mechanism);`
        },
        expectedOutput: 'Ethereum Overview: Ethereum - Smart Contract Platform\nMainnet Chain ID: 1\nGas: Fee paid to execute transactions\nConsensus: Proof of Stake (PoS)',
        hints: [
          'Always use testnets for development',
          'Gas fees vary based on network activity'
        ]
      }
    ]
  },
  {
    id: 'setup-environment',
    title: 'Setting Up Your Dev Environment',
    description: 'Configure your development environment for Web3 and smart contract development',
    category: 'getting-started',
    difficulty: 'beginner',
    estimatedTime: '25 min',
    prerequisites: ['intro-web3'],
    languages: ['javascript', 'typescript'],
    steps: [
      {
        id: 'setup-step-1',
        title: 'Install Node.js',
        description: 'Install Node.js, the JavaScript runtime needed for Web3 development.',
        explanation: 'Node.js allows you to run JavaScript outside the browser and is essential for running development tools, testing frameworks, and deployment scripts.',
        code: {
          javascript: `// Check if Node.js is installed
// Run these commands in your terminal:

// Check Node.js version
// $ node --version
// Expected output: v18.x.x or higher

// Check npm version
// $ npm --version
// Expected output: 9.x.x or higher

// If not installed, download from:
// https://nodejs.org/

// Verify installation
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);`
        },
        expectedOutput: 'Node.js version: v18.x.x\nPlatform: linux/darwin/win32\nArchitecture: x64/arm64',
        hints: [
          'Use Node.js LTS (Long Term Support) version',
          'Consider using nvm for managing multiple Node versions'
        ]
      },
      {
        id: 'setup-step-2',
        title: 'Install Development Tools',
        description: 'Set up essential tools: Hardhat, ethers.js, and VS Code extensions.',
        explanation: 'Hardhat is the most popular development framework for Ethereum. ethers.js is a library for interacting with the blockchain.',
        code: {
          javascript: `// Create a new project and install dependencies
// Run these commands in your terminal:

// Create project directory
// $ mkdir my-web3-project
// $ cd my-web3-project

// Initialize npm project
// $ npm init -y

// Install Hardhat (development framework)
// $ npm install --save-dev hardhat

// Install ethers.js (blockchain interaction)
// $ npm install ethers

// Install OpenZeppelin contracts (secure templates)
// $ npm install @openzeppelin/contracts

// Install testing libraries
// $ npm install --save-dev chai @nomicfoundation/hardhat-toolbox

// Project structure after setup:
const projectStructure = {
  'contracts/': 'Your Solidity smart contracts',
  'scripts/': 'Deployment and interaction scripts',
  'test/': 'Contract test files',
  'hardhat.config.js': 'Hardhat configuration',
  'package.json': 'Project dependencies'
};

console.log('Project structure:', projectStructure);`
        },
        expectedOutput: 'Project structure: { contracts/: "Your Solidity smart contracts", ... }',
        hints: [
          'Hardhat provides a local blockchain for testing',
          'OpenZeppelin contracts are audited and secure'
        ]
      },
      {
        id: 'setup-step-3',
        title: 'Initialize Hardhat Project',
        description: 'Create a new Hardhat project with sample contracts.',
        explanation: 'Hardhat provides a complete development environment with compilation, testing, and deployment capabilities.',
        code: {
          javascript: `// Initialize Hardhat project
// $ npx hardhat init

// Select: Create a JavaScript project
// This creates:
// - contracts/Lock.sol (sample contract)
// - scripts/deploy.js (deployment script)
// - test/Lock.js (test file)
// - hardhat.config.js (configuration)

// Sample hardhat.config.js
const hardhatConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      // Local development network
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/YOUR_API_KEY",
      accounts: ["YOUR_PRIVATE_KEY"] // Never commit this!
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

console.log('Hardhat config:', hardhatConfig);

// Compile contracts
// $ npx hardhat compile

// Run tests
// $ npx hardhat test

// Start local node
// $ npx hardhat node`
        },
        expectedOutput: 'Hardhat config: { solidity: "0.8.19", networks: {...}, paths: {...} }',
        hints: [
          'Never commit private keys to version control',
          'Use environment variables for sensitive data'
        ]
      },
      {
        id: 'setup-step-4',
        title: 'VS Code Extensions',
        description: 'Install recommended VS Code extensions for Solidity development.',
        explanation: 'VS Code extensions provide syntax highlighting, linting, and debugging support for Solidity development.',
        code: {
          javascript: `// Recommended VS Code Extensions for Web3 Development

const vsCodeExtensions = [
  {
    name: 'Solidity',
    id: 'JuanBlanco.solidity',
    features: ['Syntax highlighting', 'Compilation', 'Linting']
  },
  {
    name: 'Hardhat Solidity',
    id: 'NomicFoundation.hardhat-solidity',
    features: ['Code navigation', 'Inline error messages', 'Quick fixes']
  },
  {
    name: 'Prettier - Solidity',
    id: 'esbenp.prettier-vscode',
    features: ['Code formatting', 'Consistent style']
  },
  {
    name: 'GitLens',
    id: 'eamodio.gitlens',
    features: ['Git integration', 'Blame annotations']
  },
  {
    name: 'Error Lens',
    id: 'usernamehw.errorlens',
    features: ['Inline error display', 'Quick debugging']
  }
];

// Install via command palette (Ctrl+Shift+X)
// Or via terminal:
// $ code --install-extension JuanBlanco.solidity

console.log('Recommended extensions:');
vsCodeExtensions.forEach(ext => {
  console.log(\`- \${ext.name}: \${ext.features.join(', ')}\`);
});`
        },
        expectedOutput: 'Recommended extensions:\n- Solidity: Syntax highlighting, Compilation, Linting\n- Hardhat Solidity: Code navigation, Inline error messages, Quick fixes\n...',
        hints: [
          'Extensions significantly improve development experience',
          'Solidity extension provides real-time compilation feedback'
        ]
      },
      {
        id: 'setup-step-5',
        title: 'Environment Variables',
        description: 'Securely manage API keys and private keys using environment variables.',
        explanation: 'Environment variables keep sensitive information out of your code and version control.',
        code: {
          javascript: `// Install dotenv for environment variable management
// $ npm install dotenv

// Create .env file (add to .gitignore!)
const envFileContent = \`
# API Keys
INFURA_API_KEY=your_infura_key_here
ALCHEMY_API_KEY=your_alchemy_key_here

# Private Keys (NEVER share or commit!)
PRIVATE_KEY=your_private_key_here

# Etherscan for contract verification
ETHERSCAN_API_KEY=your_etherscan_key_here
\`;

// Create .gitignore
const gitignoreContent = \`
node_modules
.env
cache
artifacts
coverage
coverage.json
\`;

// Load in your scripts
// require('dotenv').config();
// const privateKey = process.env.PRIVATE_KEY;

console.log('Environment setup:');
console.log('1. Create .env file with your keys');
console.log('2. Add .env to .gitignore');
console.log('3. Use process.env to access variables');

// Example usage in hardhat.config.js:
const exampleConfig = \`
require('dotenv').config();

module.exports = {
  networks: {
    sepolia: {
      url: \\\`https://sepolia.infura.io/v3/\\\${process.env.INFURA_API_KEY}\\\`,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
\`;
console.log('Example config:', exampleConfig);`
        },
        expectedOutput: 'Environment setup:\n1. Create .env file with your keys\n2. Add .env to .gitignore\n3. Use process.env to access variables',
        hints: [
          'Never commit .env files to git',
          'Use a password manager for key storage'
        ]
      }
    ]
  },
  {
    id: 'solidity-intro',
    title: 'Introduction to Solidity',
    description: 'Learn the basics of Solidity, the programming language for Ethereum smart contracts',
    category: 'solidity-basics',
    difficulty: 'beginner',
    estimatedTime: '30 min',
    prerequisites: ['setup-environment'],
    languages: ['solidity'],
    steps: [
      {
        id: 'sol-intro-1',
        title: 'Your First Smart Contract',
        description: 'Write your first Solidity smart contract.',
        explanation: 'Solidity is a statically-typed programming language designed for developing smart contracts. Every contract starts with a pragma directive and contract declaration.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// A simple contract that stores a message
contract HelloWorld {
    // State variable stored on the blockchain
    string public message;
    
    // Constructor runs once when contract is deployed
    constructor(string memory _message) {
        message = _message;
    }
    
    // Function to update the message
    function setMessage(string memory _newMessage) public {
        message = _newMessage;
    }
    
    // Function to read the message (view = doesn't modify state)
    function getMessage() public view returns (string memory) {
        return message;
    }
}

// Key concepts:
// - pragma: specifies compiler version
// - contract: like a class in other languages
// - public: accessible from outside the contract
// - memory: temporary data location
// - view: function doesn't modify state`
        },
        expectedOutput: 'Contract compiled successfully!\nDeployed at: 0x...\nmessage: "Hello, Web3!"',
        hints: [
          'Always include SPDX license identifier',
          'Use pragma to specify Solidity version'
        ]
      },
      {
        id: 'sol-intro-2',
        title: 'Data Types',
        description: 'Learn about Solidity data types: integers, addresses, booleans, and strings.',
        explanation: 'Solidity has several primitive data types. Understanding them is crucial for efficient and secure smart contract development.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DataTypes {
    // Unsigned integers (cannot be negative)
    uint256 public largeNumber = 1000000;
    uint8 public smallNumber = 255; // Max value for uint8
    
    // Signed integers (can be negative)
    int256 public signedNumber = -100;
    
    // Boolean
    bool public isActive = true;
    
    // Address - 20 byte Ethereum address
    address public owner;
    address payable public recipient; // Can receive ETH
    
    // Bytes and String
    bytes32 public fixedData = "Hello"; // Fixed size, gas efficient
    string public dynamicText = "Hello, Blockchain!";
    
    constructor() {
        owner = msg.sender; // Set deployer as owner
    }
    
    // Function demonstrating type usage
    function updateValues(
        uint256 _number,
        bool _status,
        string memory _text
    ) public {
        largeNumber = _number;
        isActive = _status;
        dynamicText = _text;
    }
    
    // Get contract's ETH balance
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

// Type sizes:
// uint8: 0 to 255
// uint16: 0 to 65,535
// uint256: 0 to 2^256-1 (huge!)`
        },
        expectedOutput: 'largeNumber: 1000000\nsmallNumber: 255\nisActive: true\nowner: 0x...',
        hints: [
          'uint256 is the most commonly used integer type',
          'address payable is needed to send ETH to an address'
        ]
      },
      {
        id: 'sol-intro-3',
        title: 'Functions and Visibility',
        description: 'Understand function types and visibility modifiers in Solidity.',
        explanation: 'Functions in Solidity have visibility modifiers that control access. They can also be marked as view, pure, or payable depending on their behavior.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FunctionTypes {
    uint256 private value;
    
    // PUBLIC - callable from anywhere
    function publicFunction() public pure returns (string memory) {
        return "Anyone can call this";
    }
    
    // PRIVATE - only this contract
    function privateFunction() private pure returns (string memory) {
        return "Only this contract";
    }
    
    // INTERNAL - this contract and derived contracts
    function internalFunction() internal pure returns (string memory) {
        return "This contract and children";
    }
    
    // EXTERNAL - only from outside (gas efficient for external calls)
    function externalFunction() external pure returns (string memory) {
        return "Only external calls";
    }
    
    // VIEW - reads state but doesn't modify
    function getValue() public view returns (uint256) {
        return value;
    }
    
    // PURE - doesn't read or modify state
    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;
    }
    
    // PAYABLE - can receive ETH
    function deposit() public payable {
        value += msg.value;
    }
    
    // Example of calling private function internally
    function callPrivate() public pure returns (string memory) {
        return privateFunction();
    }
}

// Visibility Summary:
// public    - Yes   Yes      Yes       Yes
// private   - Yes   No       No        No
// internal  - Yes   No       Yes       No
// external  - No    Yes      No        No`
        },
        expectedOutput: 'publicFunction: "Anyone can call this"\ngetValue: 0\nadd(5, 3): 8',
        hints: [
          'Use external for functions only called from outside',
          'pure functions save gas as they don\'t access storage'
        ]
      },
      {
        id: 'sol-intro-4',
        title: 'State Variables and Storage',
        description: 'Learn about data locations: storage, memory, and calldata.',
        explanation: 'Solidity has three data locations: storage (persistent), memory (temporary), and calldata (read-only). Understanding these is crucial for gas optimization.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DataLocations {
    // State variables are stored in STORAGE (persistent)
    string public storedText = "I persist on blockchain";
    uint256[] public numbers;
    
    // Using MEMORY - temporary, only exists during function execution
    function processInMemory(string memory input) public pure returns (string memory) {
        // memory variable - temporary copy
        string memory temp = input;
        return temp;
    }
    
    // Using CALLDATA - read-only, gas efficient for external calls
    function processCalldata(string calldata input) external pure returns (uint256) {
        // calldata is read-only, cannot modify
        return bytes(input).length;
    }
    
    // Storage vs Memory example
    function addNumber(uint256 _num) public {
        // This modifies storage (costs gas)
        numbers.push(_num);
    }
    
    function getNumbers() public view returns (uint256[] memory) {
        // Returns a memory copy of storage array
        return numbers;
    }
    
    // Modifying storage through reference
    function updateFirstNumber(uint256 _newValue) public {
        require(numbers.length > 0, "Array is empty");
        
        // storage reference - changes persist
        uint256[] storage nums = numbers;
        nums[0] = _newValue;
    }
    
    // Gas comparison example
    function inefficientLoop() public view returns (uint256) {
        uint256 total = 0;
        // Reading from storage in loop = expensive!
        for (uint256 i = 0; i < numbers.length; i++) {
            total += numbers[i];
        }
        return total;
    }
    
    function efficientLoop() public view returns (uint256) {
        // Copy to memory first = cheaper reads in loop
        uint256[] memory nums = numbers;
        uint256 total = 0;
        for (uint256 i = 0; i < nums.length; i++) {
            total += nums[i];
        }
        return total;
    }
}`
        },
        expectedOutput: 'storedText: "I persist on blockchain"\nnumbers: []\nAfter addNumber(5): numbers: [5]',
        hints: [
          'Storage reads/writes are expensive - minimize them',
          'Use memory for temporary data in functions'
        ]
      },
      {
        id: 'sol-intro-5',
        title: 'Events and Logging',
        description: 'Emit events to log important contract actions.',
        explanation: 'Events are a way to log data to the blockchain. They\'re cheaper than storage and can be monitored by off-chain applications.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EventLogger {
    // Define events
    event ValueChanged(
        address indexed sender,    // indexed = searchable
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp
    );
    
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    
    event Log(string message);
    
    uint256 public value;
    mapping(address => uint256) public balances;
    
    constructor() {
        emit Log("Contract deployed!");
    }
    
    function setValue(uint256 _newValue) public {
        uint256 oldValue = value;
        value = _newValue;
        
        // Emit event with all relevant data
        emit ValueChanged(
            msg.sender,
            oldValue,
            _newValue,
            block.timestamp
        );
    }
    
    function transfer(address _to, uint256 _amount) public {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        
        balances[msg.sender] -= _amount;
        balances[_to] += _amount;
        
        emit Transfer(msg.sender, _to, _amount);
    }
    
    // Deposit ETH and log it
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }
}

// Events are used for:
// 1. Cheap data storage (logs, not state)
// 2. Triggering off-chain actions
// 3. Historical record of actions
// 4. Frontend updates via event listeners`
        },
        expectedOutput: 'Event ValueChanged emitted:\n  sender: 0x...\n  oldValue: 0\n  newValue: 100\n  timestamp: 1703...',
        hints: [
          'Use indexed for values you want to filter/search',
          'Maximum 3 indexed parameters per event'
        ]
      }
    ]
  },
  {
    id: 'arrays-mappings',
    title: 'Arrays and Mappings',
    description: 'Master arrays and mappings, the essential data structures in Solidity',
    category: 'solidity-basics',
    difficulty: 'beginner',
    estimatedTime: '25 min',
    prerequisites: ['solidity-intro'],
    languages: ['solidity'],
    steps: [
      {
        id: 'arr-map-1',
        title: 'Fixed and Dynamic Arrays',
        description: 'Learn the difference between fixed-size and dynamic arrays.',
        explanation: 'Arrays in Solidity can be fixed-size (length set at compile time) or dynamic (can grow/shrink). Each has different gas costs and use cases.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ArrayExamples {
    // Fixed-size array - size set at compile time
    uint256[5] public fixedArray;
    
    // Dynamic array - can grow/shrink
    uint256[] public dynamicArray;
    
    // Array of addresses
    address[] public users;
    
    constructor() {
        // Initialize fixed array
        fixedArray = [1, 2, 3, 4, 5];
        
        // Initialize dynamic array with push
        dynamicArray.push(10);
        dynamicArray.push(20);
    }
    
    // Add element to dynamic array
    function addNumber(uint256 _num) public {
        dynamicArray.push(_num);
    }
    
    // Remove last element
    function removeLast() public {
        require(dynamicArray.length > 0, "Array is empty");
        dynamicArray.pop();
    }
    
    // Get array length
    function getLength() public view returns (uint256) {
        return dynamicArray.length;
    }
    
    // Get element at index
    function getElement(uint256 _index) public view returns (uint256) {
        require(_index < dynamicArray.length, "Index out of bounds");
        return dynamicArray[_index];
    }
    
    // Update element
    function updateElement(uint256 _index, uint256 _value) public {
        require(_index < dynamicArray.length, "Index out of bounds");
        dynamicArray[_index] = _value;
    }
    
    // Return entire array (expensive for large arrays!)
    function getAllNumbers() public view returns (uint256[] memory) {
        return dynamicArray;
    }
    
    // Delete element (sets to default, doesn't shrink array)
    function deleteElement(uint256 _index) public {
        delete dynamicArray[_index]; // Sets to 0
    }
}`
        },
        expectedOutput: 'fixedArray: [1, 2, 3, 4, 5]\ndynamicArray: [10, 20]\nAfter push(30): [10, 20, 30]',
        hints: [
          'Fixed arrays are more gas efficient',
          'pop() removes last element, delete sets to default'
        ]
      },
      {
        id: 'arr-map-2',
        title: 'Working with Mappings',
        description: 'Use mappings for key-value storage.',
        explanation: 'Mappings are hash tables that map keys to values. They\'re the most commonly used data structure in Solidity for lookups.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MappingExamples {
    // Simple mapping: address => balance
    mapping(address => uint256) public balances;
    
    // Mapping with custom type
    mapping(address => bool) public isRegistered;
    
    // Mapping string to uint
    mapping(string => uint256) public ages;
    
    // Get balance for an address
    function getBalance(address _addr) public view returns (uint256) {
        return balances[_addr]; // Returns 0 if not set
    }
    
    // Set balance
    function setBalance(address _addr, uint256 _amount) public {
        balances[_addr] = _amount;
    }
    
    // Deposit function
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    // Register a user
    function register() public {
        require(!isRegistered[msg.sender], "Already registered");
        isRegistered[msg.sender] = true;
    }
    
    // Check if registered
    function checkRegistration(address _addr) public view returns (bool) {
        return isRegistered[_addr];
    }
    
    // Delete mapping entry
    function removeUser(address _addr) public {
        delete balances[_addr];     // Sets to 0
        delete isRegistered[_addr]; // Sets to false
    }
}

// Key points about mappings:
// - Keys are not stored, only their keccak256 hash
// - Cannot iterate over mappings
// - All values exist (default to zero/false)
// - Cannot get list of all keys`
        },
        expectedOutput: 'balances[0x...]: 0 (default)\nAfter deposit 1 ETH: balances[0x...]: 1000000000000000000\nisRegistered[0x...]: true',
        hints: [
          'Mappings don\'t store keys - you can\'t iterate',
          'All possible keys exist with default values'
        ]
      },
      {
        id: 'arr-map-3',
        title: 'Nested Mappings',
        description: 'Create complex data structures with nested mappings.',
        explanation: 'Nested mappings allow you to create multi-dimensional lookups, like user -> token -> balance for multi-token contracts.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NestedMappings {
    // Nested mapping: owner => spender => allowance
    // Used in ERC-20 tokens for approvals
    mapping(address => mapping(address => uint256)) public allowances;
    
    // User => Token => Balance (multi-token wallet)
    mapping(address => mapping(address => uint256)) public tokenBalances;
    
    // Approval system like ERC-20
    function approve(address _spender, uint256 _amount) public {
        allowances[msg.sender][_spender] = _amount;
    }
    
    function getAllowance(
        address _owner, 
        address _spender
    ) public view returns (uint256) {
        return allowances[_owner][_spender];
    }
    
    // Transfer from with allowance
    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) public {
        uint256 allowed = allowances[_from][msg.sender];
        require(allowed >= _amount, "Allowance exceeded");
        
        allowances[_from][msg.sender] -= _amount;
        // Transfer logic would go here
    }
    
    // Multi-token deposit tracking
    function depositToken(address _token, uint256 _amount) public {
        tokenBalances[msg.sender][_token] += _amount;
    }
    
    function getTokenBalance(
        address _user, 
        address _token
    ) public view returns (uint256) {
        return tokenBalances[_user][_token];
    }
}

// Use case examples:
// - ERC-20 allowances
// - Multi-token wallets
// - Game inventories (player => item => quantity)
// - Voting (proposal => voter => voted)`
        },
        expectedOutput: 'allowances[owner][spender]: 0\nAfter approve(spender, 100): allowances[owner][spender]: 100',
        hints: [
          'Nested mappings are common in token contracts',
          'Think of them as 2D lookup tables'
        ]
      },
      {
        id: 'arr-map-4',
        title: 'Structs with Mappings',
        description: 'Combine structs with mappings for complex data models.',
        explanation: 'Combining structs with mappings allows you to create rich data models, similar to database tables in traditional applications.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract UserRegistry {
    // Define a struct for user data
    struct User {
        uint256 id;
        string name;
        address wallet;
        uint256 balance;
        bool isActive;
        uint256 createdAt;
    }
    
    // Mapping from address to User
    mapping(address => User) public users;
    
    // Track all user addresses
    address[] public userAddresses;
    
    // Counter for user IDs
    uint256 public nextUserId = 1;
    
    event UserCreated(address indexed wallet, uint256 id, string name);
    event UserUpdated(address indexed wallet, string name);
    
    // Register a new user
    function registerUser(string memory _name) public {
        require(users[msg.sender].id == 0, "Already registered");
        
        users[msg.sender] = User({
            id: nextUserId,
            name: _name,
            wallet: msg.sender,
            balance: 0,
            isActive: true,
            createdAt: block.timestamp
        });
        
        userAddresses.push(msg.sender);
        emit UserCreated(msg.sender, nextUserId, _name);
        
        nextUserId++;
    }
    
    // Update user name
    function updateName(string memory _newName) public {
        require(users[msg.sender].id != 0, "Not registered");
        users[msg.sender].name = _newName;
        emit UserUpdated(msg.sender, _newName);
    }
    
    // Get user details
    function getUser(address _addr) public view returns (User memory) {
        return users[_addr];
    }
    
    // Get total users
    function getTotalUsers() public view returns (uint256) {
        return userAddresses.length;
    }
    
    // Deactivate user
    function deactivateUser() public {
        users[msg.sender].isActive = false;
    }
}`
        },
        expectedOutput: 'User registered: { id: 1, name: "Alice", wallet: 0x..., balance: 0, isActive: true }',
        hints: [
          'Store addresses in array to iterate over users',
          'Structs can\'t be returned in older Solidity versions'
        ]
      },
      {
        id: 'arr-map-5',
        title: 'Iterable Mappings Pattern',
        description: 'Implement a pattern to iterate over mapping keys.',
        explanation: 'Since mappings can\'t be iterated, we combine them with arrays to track all keys, enabling enumeration while keeping O(1) lookups.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract IterableMapping {
    // Mapping for O(1) lookups
    mapping(address => uint256) private balances;
    
    // Array to track all keys
    address[] private keys;
    
    // Track if address exists in keys
    mapping(address => bool) private inserted;
    
    // Add or update balance
    function set(address _key, uint256 _value) public {
        balances[_key] = _value;
        
        if (!inserted[_key]) {
            inserted[_key] = true;
            keys.push(_key);
        }
    }
    
    // Get balance
    function get(address _key) public view returns (uint256) {
        return balances[_key];
    }
    
    // Get number of keys
    function size() public view returns (uint256) {
        return keys.length;
    }
    
    // Get key at index
    function getKeyAtIndex(uint256 _index) public view returns (address) {
        require(_index < keys.length, "Index out of bounds");
        return keys[_index];
    }
    
    // Get all keys
    function getAllKeys() public view returns (address[] memory) {
        return keys;
    }
    
    // Calculate total of all balances
    function getTotal() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < keys.length; i++) {
            total += balances[keys[i]];
        }
        return total;
    }
    
    // Remove key (swap and pop for gas efficiency)
    function remove(address _key) public {
        require(inserted[_key], "Key does not exist");
        
        delete balances[_key];
        inserted[_key] = false;
        
        // Find and remove from array
        for (uint256 i = 0; i < keys.length; i++) {
            if (keys[i] == _key) {
                // Swap with last element and pop
                keys[i] = keys[keys.length - 1];
                keys.pop();
                break;
            }
        }
    }
}

// Pattern benefits:
// - O(1) lookups via mapping
// - Enumerable keys via array
// - Can calculate totals, averages, etc.`
        },
        expectedOutput: 'size(): 3\ngetAllKeys(): [0x..., 0x..., 0x...]\ngetTotal(): 150',
        hints: [
          'This pattern is used in OpenZeppelin EnumerableMap',
          'Removal is O(n) - consider if you need it'
        ]
      }
    ]
  },
  {
    id: 'ethers-intro',
    title: 'Introduction to ethers.js',
    description: 'Learn to interact with Ethereum using ethers.js, the essential JavaScript library for Web3',
    category: 'web3-frontend',
    difficulty: 'beginner',
    estimatedTime: '30 min',
    prerequisites: ['intro-web3', 'setup-environment'],
    languages: ['javascript', 'typescript'],
    steps: [
      {
        id: 'ethers-1',
        title: 'Setting Up ethers.js',
        description: 'Install and configure ethers.js in your project.',
        explanation: 'ethers.js is a complete, compact library for interacting with Ethereum. It\'s the most popular choice for modern dApp development.',
        code: {
          javascript: `// Install ethers.js
// $ npm install ethers

// Import ethers (v6 syntax)
import { ethers } from 'ethers';

// Check version
console.log('ethers version:', ethers.version);

// Key components of ethers.js:
const ethersComponents = {
  Provider: 'Connection to Ethereum network (read-only)',
  Signer: 'Ethereum account that can sign transactions',
  Contract: 'Deployed smart contract interface',
  Wallet: 'A Signer backed by a private key',
  Utils: 'Utilities for encoding, formatting, etc.'
};

console.log('ethers.js components:', ethersComponents);

// Create a provider (read-only connection)
// Using default provider (mainnet)
const defaultProvider = ethers.getDefaultProvider('mainnet');

// Using Infura
const infuraProvider = new ethers.InfuraProvider('mainnet', 'YOUR_API_KEY');

// Using Alchemy  
const alchemyProvider = new ethers.AlchemyProvider('mainnet', 'YOUR_API_KEY');

// Using custom RPC
const jsonRpcProvider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY');

console.log('Provider created successfully!');`,
          typescript: `// Install ethers.js
// $ npm install ethers

// Import ethers (v6 syntax)
import { ethers, Provider, Signer, Contract } from 'ethers';

// Check version
console.log('ethers version:', ethers.version);

// Key components of ethers.js:
interface EthersComponents {
  Provider: string;
  Signer: string;
  Contract: string;
  Wallet: string;
  Utils: string;
}

const ethersComponents: EthersComponents = {
  Provider: 'Connection to Ethereum network (read-only)',
  Signer: 'Ethereum account that can sign transactions',
  Contract: 'Deployed smart contract interface',
  Wallet: 'A Signer backed by a private key',
  Utils: 'Utilities for encoding, formatting, etc.'
};

console.log('ethers.js components:', ethersComponents);

// Create providers with proper typing
const defaultProvider: Provider = ethers.getDefaultProvider('mainnet');
const jsonRpcProvider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY');

console.log('Provider created successfully!');`
        },
        expectedOutput: 'ethers version: 6.x.x\nethers.js components: { Provider: "...", Signer: "...", ... }\nProvider created successfully!',
        hints: [
          'ethers v6 has different syntax than v5',
          'Use environment variables for API keys'
        ]
      },
      {
        id: 'ethers-2',
        title: 'Connecting to Browser Wallet',
        description: 'Connect to MetaMask and other browser wallets.',
        explanation: 'BrowserProvider wraps the browser\'s ethereum object (injected by MetaMask) to create an ethers provider and signer.',
        code: {
          javascript: `import { ethers } from 'ethers';

async function connectWallet() {
  // Check if window.ethereum exists
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Please install MetaMask!');
  }
  
  // Create a BrowserProvider (wraps window.ethereum)
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  // Request account access (prompts user)
  const accounts = await provider.send('eth_requestAccounts', []);
  console.log('Connected accounts:', accounts);
  
  // Get the signer (can sign transactions)
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  console.log('Connected address:', address);
  
  // Get network info
  const network = await provider.getNetwork();
  console.log('Network:', network.name, 'Chain ID:', network.chainId);
  
  // Get balance
  const balance = await provider.getBalance(address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  
  return { provider, signer, address, balance };
}

// Usage
connectWallet()
  .then(({ address, balance }) => {
    console.log(\`Wallet \${address} has \${ethers.formatEther(balance)} ETH\`);
  })
  .catch(console.error);`,
          typescript: `import { ethers, BrowserProvider, Signer } from 'ethers';

interface WalletConnection {
  provider: BrowserProvider;
  signer: Signer;
  address: string;
  balance: bigint;
}

async function connectWallet(): Promise<WalletConnection> {
  // Check if window.ethereum exists
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Please install MetaMask!');
  }
  
  // Create a BrowserProvider (wraps window.ethereum)
  const provider = new ethers.BrowserProvider(window.ethereum);
  
  // Request account access (prompts user)
  const accounts = await provider.send('eth_requestAccounts', []);
  console.log('Connected accounts:', accounts);
  
  // Get the signer (can sign transactions)
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  console.log('Connected address:', address);
  
  // Get network info
  const network = await provider.getNetwork();
  console.log('Network:', network.name, 'Chain ID:', network.chainId);
  
  // Get balance
  const balance = await provider.getBalance(address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  
  return { provider, signer, address, balance };
}

// Usage
connectWallet()
  .then(({ address, balance }) => {
    console.log(\`Wallet \${address} has \${ethers.formatEther(balance)} ETH\`);
  })
  .catch(console.error);`
        },
        expectedOutput: 'Connected accounts: ["0x..."]\nConnected address: 0x...\nNetwork: mainnet Chain ID: 1n\nBalance: 1.5 ETH',
        hints: [
          'BrowserProvider is the v6 replacement for Web3Provider',
          'getSigner() requires user to be connected first'
        ]
      },
      {
        id: 'ethers-3',
        title: 'Reading Blockchain Data',
        description: 'Query blockchain data: blocks, transactions, and balances.',
        explanation: 'Providers allow you to read data from the blockchain without needing a signer or private key.',
        code: {
          javascript: `import { ethers } from 'ethers';

async function readBlockchainData() {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  
  // Get current block number
  const blockNumber = await provider.getBlockNumber();
  console.log('Current block:', blockNumber);
  
  // Get block details
  const block = await provider.getBlock(blockNumber);
  console.log('Block hash:', block.hash);
  console.log('Block timestamp:', new Date(block.timestamp * 1000));
  console.log('Transactions in block:', block.transactions.length);
  
  // Get gas price
  const feeData = await provider.getFeeData();
  console.log('Gas price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
  console.log('Max fee:', ethers.formatUnits(feeData.maxFeePerGas, 'gwei'), 'gwei');
  
  // Get balance of any address
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const balance = await provider.getBalance(vitalikAddress);
  console.log('Vitalik balance:', ethers.formatEther(balance), 'ETH');
  
  // Get transaction count (nonce)
  const txCount = await provider.getTransactionCount(vitalikAddress);
  console.log('Transaction count:', txCount);
  
  // Get transaction details
  const txHash = '0x...'; // Replace with real tx hash
  // const tx = await provider.getTransaction(txHash);
  // const receipt = await provider.getTransactionReceipt(txHash);
  
  return { blockNumber, block, balance };
}

readBlockchainData().catch(console.error);`,
          typescript: `import { ethers, Block, TransactionReceipt } from 'ethers';

interface BlockchainData {
  blockNumber: number;
  block: Block | null;
  balance: bigint;
}

async function readBlockchainData(): Promise<BlockchainData> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  
  // Get current block number
  const blockNumber = await provider.getBlockNumber();
  console.log('Current block:', blockNumber);
  
  // Get block details
  const block = await provider.getBlock(blockNumber);
  if (block) {
    console.log('Block hash:', block.hash);
    console.log('Block timestamp:', new Date(block.timestamp * 1000));
    console.log('Transactions in block:', block.transactions.length);
  }
  
  // Get gas price
  const feeData = await provider.getFeeData();
  if (feeData.gasPrice) {
    console.log('Gas price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
  }
  
  // Get balance of any address
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const balance = await provider.getBalance(vitalikAddress);
  console.log('Vitalik balance:', ethers.formatEther(balance), 'ETH');
  
  return { blockNumber, block, balance };
}

readBlockchainData().catch(console.error);`
        },
        expectedOutput: 'Current block: 18500000\nBlock hash: 0x...\nGas price: 25.5 gwei\nVitalik balance: 1234.56 ETH',
        hints: [
          'All provider methods are async',
          'Use formatEther and formatUnits for readable output'
        ]
      },
      {
        id: 'ethers-4',
        title: 'Interacting with Smart Contracts',
        description: 'Read from and write to smart contracts.',
        explanation: 'The Contract class creates a JavaScript interface for any smart contract using its ABI (Application Binary Interface).',
        code: {
          javascript: `import { ethers } from 'ethers';

// ERC-20 Token ABI (simplified)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function interactWithToken() {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  
  // USDC contract address on Ethereum
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  
  // Create contract instance (read-only with provider)
  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
  
  // Read contract data
  const name = await usdc.name();
  const symbol = await usdc.symbol();
  const decimals = await usdc.decimals();
  const totalSupply = await usdc.totalSupply();
  
  console.log('Token:', name, '(' + symbol + ')');
  console.log('Decimals:', decimals);
  console.log('Total Supply:', ethers.formatUnits(totalSupply, decimals));
  
  // Check balance of an address
  const holder = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'; // Binance
  const balance = await usdc.balanceOf(holder);
  console.log('Holder balance:', ethers.formatUnits(balance, decimals), symbol);
  
  // To WRITE to contract, connect with signer
  // const signer = await provider.getSigner();
  // const usdcWithSigner = usdc.connect(signer);
  // const tx = await usdcWithSigner.transfer(recipient, amount);
  // await tx.wait();
  
  return { name, symbol, balance };
}

interactWithToken().catch(console.error);`,
          typescript: `import { ethers, Contract } from 'ethers';

// ERC-20 Token ABI (simplified)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

interface TokenInfo {
  name: string;
  symbol: string;
  balance: bigint;
}

async function interactWithToken(): Promise<TokenInfo> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  
  // USDC contract address on Ethereum
  const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  
  // Create contract instance (read-only with provider)
  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
  
  // Read contract data
  const name: string = await usdc.name();
  const symbol: string = await usdc.symbol();
  const decimals: bigint = await usdc.decimals();
  const totalSupply: bigint = await usdc.totalSupply();
  
  console.log('Token:', name, '(' + symbol + ')');
  console.log('Decimals:', decimals);
  console.log('Total Supply:', ethers.formatUnits(totalSupply, decimals));
  
  // Check balance of an address
  const holder = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
  const balance: bigint = await usdc.balanceOf(holder);
  console.log('Holder balance:', ethers.formatUnits(balance, decimals), symbol);
  
  return { name, symbol, balance };
}

interactWithToken().catch(console.error);`
        },
        expectedOutput: 'Token: USD Coin (USDC)\nDecimals: 6n\nTotal Supply: 25000000000.0\nHolder balance: 1500000.0 USDC',
        hints: [
          'Read functions need provider, write functions need signer',
          'Human-readable ABI is easier than JSON ABI'
        ]
      },
      {
        id: 'ethers-5',
        title: 'Sending Transactions',
        description: 'Send ETH and interact with contracts that modify state.',
        explanation: 'Transactions that modify blockchain state require a signer and cost gas. Always estimate gas and handle errors properly.',
        code: {
          javascript: `import { ethers } from 'ethers';

async function sendTransaction() {
  // Connect to wallet
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  console.log('Sending from:', address);
  
  // Check balance before
  const balanceBefore = await provider.getBalance(address);
  console.log('Balance before:', ethers.formatEther(balanceBefore), 'ETH');
  
  // Send ETH transaction
  const recipient = '0x...'; // Replace with recipient address
  const amount = ethers.parseEther('0.01'); // 0.01 ETH
  
  // Estimate gas
  const gasEstimate = await provider.estimateGas({
    to: recipient,
    value: amount
  });
  console.log('Estimated gas:', gasEstimate.toString());
  
  // Get gas price
  const feeData = await provider.getFeeData();
  console.log('Gas price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
  
  // Create and send transaction
  const tx = await signer.sendTransaction({
    to: recipient,
    value: amount,
    // Optional: set gas limit and price
    // gasLimit: gasEstimate,
    // maxFeePerGas: feeData.maxFeePerGas,
    // maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
  });
  
  console.log('Transaction sent:', tx.hash);
  console.log('Waiting for confirmation...');
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  console.log('Transaction confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Check balance after
  const balanceAfter = await provider.getBalance(address);
  console.log('Balance after:', ethers.formatEther(balanceAfter), 'ETH');
  
  return receipt;
}

// Contract interaction example
async function callContractFunction() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const contractAddress = '0x...';
  const abi = ['function setValue(uint256 newValue)'];
  
  const contract = new ethers.Contract(contractAddress, abi, signer);
  
  // Call a state-changing function
  const tx = await contract.setValue(42);
  console.log('Transaction hash:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Confirmed!', receipt);
  
  return receipt;
}

sendTransaction().catch(console.error);`,
          typescript: `import { ethers, TransactionReceipt } from 'ethers';

async function sendTransaction(): Promise<TransactionReceipt | null> {
  // Connect to wallet
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  
  console.log('Sending from:', address);
  
  // Check balance before
  const balanceBefore = await provider.getBalance(address);
  console.log('Balance before:', ethers.formatEther(balanceBefore), 'ETH');
  
  // Send ETH transaction
  const recipient = '0x...'; // Replace with recipient address
  const amount = ethers.parseEther('0.01'); // 0.01 ETH
  
  // Estimate gas
  const gasEstimate = await provider.estimateGas({
    to: recipient,
    value: amount
  });
  console.log('Estimated gas:', gasEstimate.toString());
  
  // Create and send transaction
  const tx = await signer.sendTransaction({
    to: recipient,
    value: amount
  });
  
  console.log('Transaction sent:', tx.hash);
  console.log('Waiting for confirmation...');
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  if (receipt) {
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
  }
  
  return receipt;
}

sendTransaction().catch(console.error);`
        },
        expectedOutput: 'Sending from: 0x...\nBalance before: 1.5 ETH\nEstimated gas: 21000\nTransaction sent: 0x...\nTransaction confirmed in block: 18500001',
        hints: [
          'Always wait for receipt to confirm transaction',
          'Use parseEther for ETH, parseUnits for tokens'
        ]
      }
    ]
  },
  {
    id: 'reading-contracts',
    title: 'Reading Smart Contract Data',
    description: 'Master the techniques for reading on-chain data from any smart contract',
    category: 'web3-frontend',
    difficulty: 'beginner',
    estimatedTime: '25 min',
    prerequisites: ['ethers-intro'],
    languages: ['javascript', 'typescript'],
    steps: [
      {
        id: 'read-1',
        title: 'Understanding ABIs',
        description: 'Learn what ABIs are and how to use them.',
        explanation: 'The ABI (Application Binary Interface) defines how to interact with a smart contract. It describes all functions, their parameters, and return types.',
        code: {
          javascript: `// ABI = Application Binary Interface
// It's the "interface" that describes your contract

// Full ABI format (from compilation)
const fullABI = [
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "name": "owner", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      { "name": "from", "type": "address", "indexed": true },
      { "name": "to", "type": "address", "indexed": true },
      { "name": "value", "type": "uint256", "indexed": false }
    ]
  }
];

// Human-readable ABI (ethers.js feature - much cleaner!)
const humanReadableABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

// Where to get ABIs:
// 1. Etherscan - verified contracts have ABI in "Contract" tab
// 2. Compilation output - in artifacts/contracts/X.sol/X.json
// 3. Protocol docs - often provide minimal ABIs
// 4. Write your own - for simple interactions

console.log('ABI types understood!');`,
          typescript: `import { InterfaceAbi } from 'ethers';

// Full ABI format (from compilation)
const fullABI: InterfaceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
];

// Human-readable ABI (ethers.js feature - much cleaner!)
const humanReadableABI: string[] = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

console.log('ABI types understood!');`
        },
        expectedOutput: 'ABI types understood!',
        hints: [
          'Human-readable ABIs are easier to write and maintain',
          'You only need to include functions you actually use'
        ]
      },
      {
        id: 'read-2',
        title: 'Reading ERC-20 Token Data',
        description: 'Query token balances, supply, and metadata.',
        explanation: 'ERC-20 is the standard interface for fungible tokens. All ERC-20 tokens implement the same core functions.',
        code: {
          javascript: `import { ethers } from 'ethers';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

async function readTokenData(tokenAddress, userAddress) {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  // Batch multiple calls for efficiency
  const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
    token.balanceOf(userAddress)
  ]);
  
  console.log('Token Name:', name);
  console.log('Symbol:', symbol);
  console.log('Decimals:', decimals);
  console.log('Total Supply:', ethers.formatUnits(totalSupply, decimals));
  console.log('User Balance:', ethers.formatUnits(balance, decimals));
  
  // Check allowance (for dApp approvals)
  const spender = '0x...'; // e.g., Uniswap Router
  const allowance = await token.allowance(userAddress, spender);
  console.log('Allowance to spender:', ethers.formatUnits(allowance, decimals));
  
  // Calculate user's share of total supply
  const sharePercent = (Number(balance) / Number(totalSupply) * 100).toFixed(4);
  console.log('User owns', sharePercent + '% of total supply');
  
  return { name, symbol, decimals, balance, totalSupply };
}

// Example: Read USDC data
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const user = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
readTokenData(USDC, user).catch(console.error);`,
          typescript: `import { ethers, Contract } from 'ethers';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

interface TokenData {
  name: string;
  symbol: string;
  decimals: bigint;
  balance: bigint;
  totalSupply: bigint;
}

async function readTokenData(tokenAddress: string, userAddress: string): Promise<TokenData> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  // Batch multiple calls for efficiency
  const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.decimals() as Promise<bigint>,
    token.totalSupply() as Promise<bigint>,
    token.balanceOf(userAddress) as Promise<bigint>
  ]);
  
  console.log('Token Name:', name);
  console.log('Symbol:', symbol);
  console.log('Total Supply:', ethers.formatUnits(totalSupply, decimals));
  console.log('User Balance:', ethers.formatUnits(balance, decimals));
  
  return { name, symbol, decimals, balance, totalSupply };
}

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const user = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
readTokenData(USDC, user).catch(console.error);`
        },
        expectedOutput: 'Token Name: USD Coin\nSymbol: USDC\nDecimals: 6n\nTotal Supply: 25000000000.0\nUser Balance: 1000.0',
        hints: [
          'Use Promise.all to batch read calls',
          'Always use formatUnits with correct decimals'
        ]
      },
      {
        id: 'read-3',
        title: 'Reading NFT (ERC-721) Data',
        description: 'Query NFT ownership, metadata, and collection info.',
        explanation: 'ERC-721 is the standard for non-fungible tokens. Each token has a unique ID and can have associated metadata.',
        code: {
          javascript: `import { ethers } from 'ethers';

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)'
];

async function readNFTData(nftAddress, tokenId) {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);
  
  // Get collection info
  const [name, symbol] = await Promise.all([
    nft.name(),
    nft.symbol()
  ]);
  console.log('Collection:', name, '(' + symbol + ')');
  
  // Get token owner
  const owner = await nft.ownerOf(tokenId);
  console.log('Token', tokenId, 'owned by:', owner);
  
  // Get token metadata URI
  const tokenURI = await nft.tokenURI(tokenId);
  console.log('Token URI:', tokenURI);
  
  // Fetch actual metadata (usually IPFS or HTTP)
  if (tokenURI.startsWith('ipfs://')) {
    const httpURI = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
    console.log('IPFS Gateway URL:', httpURI);
    // const metadata = await fetch(httpURI).then(r => r.json());
  }
  
  // Check how many NFTs an address owns
  const userNFTCount = await nft.balanceOf(owner);
  console.log('Owner has', userNFTCount.toString(), 'NFTs from this collection');
  
  // Check approvals
  const approved = await nft.getApproved(tokenId);
  console.log('Approved address for this token:', approved);
  
  return { name, symbol, owner, tokenURI };
}

// Example: Read Bored Ape #1
const BAYC = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
readNFTData(BAYC, 1).catch(console.error);`,
          typescript: `import { ethers } from 'ethers';

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function getApproved(uint256 tokenId) view returns (address)'
];

interface NFTData {
  name: string;
  symbol: string;
  owner: string;
  tokenURI: string;
}

async function readNFTData(nftAddress: string, tokenId: number): Promise<NFTData> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const nft = new ethers.Contract(nftAddress, ERC721_ABI, provider);
  
  const [name, symbol] = await Promise.all([
    nft.name() as Promise<string>,
    nft.symbol() as Promise<string>
  ]);
  console.log('Collection:', name, '(' + symbol + ')');
  
  const owner: string = await nft.ownerOf(tokenId);
  console.log('Token', tokenId, 'owned by:', owner);
  
  const tokenURI: string = await nft.tokenURI(tokenId);
  console.log('Token URI:', tokenURI);
  
  return { name, symbol, owner, tokenURI };
}

const BAYC = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';
readNFTData(BAYC, 1).catch(console.error);`
        },
        expectedOutput: 'Collection: BoredApeYachtClub (BAYC)\nToken 1 owned by: 0x...\nToken URI: ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1',
        hints: [
          'tokenURI often returns IPFS links',
          'Use IPFS gateways to fetch metadata'
        ]
      },
      {
        id: 'read-4',
        title: 'Reading DeFi Protocol Data',
        description: 'Query data from DeFi protocols like Uniswap and Aave.',
        explanation: 'DeFi protocols expose rich on-chain data. Understanding how to read it enables building dashboards, bots, and integrations.',
        code: {
          javascript: `import { ethers } from 'ethers';

// Uniswap V2 Pair ABI (for reading pool data)
const UNISWAP_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestamp)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

async function readUniswapPair(pairAddress) {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const pair = new ethers.Contract(pairAddress, UNISWAP_PAIR_ABI, provider);
  
  // Get token addresses
  const [token0Address, token1Address] = await Promise.all([
    pair.token0(),
    pair.token1()
  ]);
  
  // Get token info
  const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider);
  const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider);
  
  const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
    token0.symbol(),
    token1.symbol(),
    token0.decimals(),
    token1.decimals()
  ]);
  
  console.log('Pair:', symbol0 + '/' + symbol1);
  
  // Get reserves
  const reserves = await pair.getReserves();
  const reserve0 = ethers.formatUnits(reserves.reserve0, decimals0);
  const reserve1 = ethers.formatUnits(reserves.reserve1, decimals1);
  
  console.log(symbol0, 'reserve:', reserve0);
  console.log(symbol1, 'reserve:', reserve1);
  
  // Calculate price
  const price = Number(reserve1) / Number(reserve0);
  console.log('Price:', '1', symbol0, '=', price.toFixed(4), symbol1);
  
  // Get LP token supply
  const lpSupply = await pair.totalSupply();
  console.log('LP Token Supply:', ethers.formatEther(lpSupply));
  
  return { symbol0, symbol1, reserve0, reserve1, price };
}

// WETH/USDC pair on Uniswap V2
const WETH_USDC = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc';
readUniswapPair(WETH_USDC).catch(console.error);`,
          typescript: `import { ethers, Contract } from 'ethers';

const UNISWAP_PAIR_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112, uint112, uint32)',
  'function totalSupply() view returns (uint256)'
];

interface PairData {
  symbol0: string;
  symbol1: string;
  reserve0: string;
  reserve1: string;
  price: number;
}

async function readUniswapPair(pairAddress: string): Promise<PairData> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const pair = new ethers.Contract(pairAddress, UNISWAP_PAIR_ABI, provider);
  
  const [token0Address, token1Address] = await Promise.all([
    pair.token0() as Promise<string>,
    pair.token1() as Promise<string>
  ]);
  
  // Simplified for brevity
  const symbol0 = 'WETH';
  const symbol1 = 'USDC';
  const decimals0 = 18n;
  const decimals1 = 6n;
  
  const reserves = await pair.getReserves();
  const reserve0 = ethers.formatUnits(reserves[0], decimals0);
  const reserve1 = ethers.formatUnits(reserves[1], decimals1);
  
  const price = Number(reserve1) / Number(reserve0);
  console.log('Price: 1', symbol0, '=', price.toFixed(2), symbol1);
  
  return { symbol0, symbol1, reserve0, reserve1, price };
}

const WETH_USDC = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc';
readUniswapPair(WETH_USDC).catch(console.error);`
        },
        expectedOutput: 'Pair: WETH/USDC\nWETH reserve: 1000.5\nUSDC reserve: 2500000.0\nPrice: 1 WETH = 2498.75 USDC',
        hints: [
          'Reserves can be used to calculate price',
          'Always account for decimal differences'
        ]
      },
      {
        id: 'read-5',
        title: 'Multicall for Efficient Reads',
        description: 'Batch multiple contract calls into a single RPC request.',
        explanation: 'Multicall combines multiple read calls into one, reducing RPC calls and improving performance. Essential for dashboards.',
        code: {
          javascript: `import { ethers } from 'ethers';

// Multicall3 is deployed at the same address on most chains
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
];

async function multicallExample() {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);
  
  // Tokens to check
  const tokens = [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'USDT' },
    { address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', name: 'DAI' }
  ];
  
  const userAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  // Prepare calls
  const erc20Interface = new ethers.Interface([
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ]);
  
  const calls = tokens.flatMap(token => [
    {
      target: token.address,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('balanceOf', [userAddress])
    },
    {
      target: token.address,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('decimals', [])
    }
  ]);
  
  // Execute all calls in single RPC request!
  const results = await multicall.aggregate3(calls);
  
  // Decode results
  for (let i = 0; i < tokens.length; i++) {
    const balanceResult = results[i * 2];
    const decimalsResult = results[i * 2 + 1];
    
    if (balanceResult.success && decimalsResult.success) {
      const balance = erc20Interface.decodeFunctionResult('balanceOf', balanceResult.returnData)[0];
      const decimals = erc20Interface.decodeFunctionResult('decimals', decimalsResult.returnData)[0];
      console.log(tokens[i].name + ':', ethers.formatUnits(balance, decimals));
    }
  }
  
  console.log('All balances fetched in 1 RPC call!');
}

multicallExample().catch(console.error);`,
          typescript: `import { ethers, Interface } from 'ethers';

const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

interface Call {
  target: string;
  allowFailure: boolean;
  callData: string;
}

interface Result {
  success: boolean;
  returnData: string;
}

async function multicallExample(): Promise<void> {
  const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
  
  const multicallABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
  ];
  const multicall = new ethers.Contract(MULTICALL_ADDRESS, multicallABI, provider);
  
  const tokens = [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', name: 'USDC' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'USDT' }
  ];
  
  const erc20Interface = new Interface([
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ]);
  
  const userAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  const calls: Call[] = tokens.flatMap(token => [
    {
      target: token.address,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('balanceOf', [userAddress])
    },
    {
      target: token.address,
      allowFailure: true,
      callData: erc20Interface.encodeFunctionData('decimals', [])
    }
  ]);
  
  const results: Result[] = await multicall.aggregate3(calls);
  console.log('All balances fetched in 1 RPC call!');
}

multicallExample().catch(console.error);`
        },
        expectedOutput: 'USDC: 1000.0\nUSDT: 500.0\nDAI: 2500.0\nAll balances fetched in 1 RPC call!',
        hints: [
          'Multicall3 is at same address on most EVM chains',
          'Use allowFailure to handle individual call failures'
        ]
      }
    ]
  },
  {
    id: 'writing-transactions',
    title: 'Writing Transactions',
    description: 'Learn to send transactions that modify blockchain state safely and efficiently',
    category: 'web3-frontend',
    difficulty: 'intermediate',
    estimatedTime: '35 min',
    prerequisites: ['ethers-intro', 'reading-contracts'],
    languages: ['javascript', 'typescript'],
    steps: [
      {
        id: 'write-1',
        title: 'Understanding Transaction Types',
        description: 'Learn the difference between legacy and EIP-1559 transactions.',
        explanation: 'Ethereum supports two transaction types: legacy (Type 0) with gasPrice, and EIP-1559 (Type 2) with maxFeePerGas and maxPriorityFeePerGas.',
        code: {
          javascript: `import { ethers } from 'ethers';

async function understandTransactionTypes() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Get current fee data
  const feeData = await provider.getFeeData();
  console.log('Current fee data:');
  console.log('  Gas Price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
  console.log('  Max Fee:', ethers.formatUnits(feeData.maxFeePerGas, 'gwei'), 'gwei');
  console.log('  Max Priority Fee:', ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei'), 'gwei');
  
  // Legacy transaction (Type 0) - avoid on modern networks
  const legacyTx = {
    to: '0x...',
    value: ethers.parseEther('0.01'),
    gasPrice: feeData.gasPrice,      // Fixed gas price
    gasLimit: 21000n,                // Gas limit for simple ETH transfer
    type: 0                          // Explicitly legacy
  };
  
  // EIP-1559 transaction (Type 2) - recommended
  const eip1559Tx = {
    to: '0x...',
    value: ethers.parseEther('0.01'),
    maxFeePerGas: feeData.maxFeePerGas,             // Max total fee
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas, // Tip to validator
    gasLimit: 21000n,
    type: 2                          // Explicitly EIP-1559
  };
  
  // EIP-1559 benefits:
  // - More predictable fees
  // - Automatic refund if gas price drops
  // - Base fee is burned (deflationary)
  
  console.log('Legacy TX gas cost:', 
    ethers.formatEther(feeData.gasPrice * 21000n), 'ETH');
  console.log('EIP-1559 max cost:', 
    ethers.formatEther(feeData.maxFeePerGas * 21000n), 'ETH');
  
  // ethers.js uses EIP-1559 by default on supported chains
  console.log('ethers.js defaults to EIP-1559 when available');
}

understandTransactionTypes().catch(console.error);`,
          typescript: `import { ethers, TransactionRequest } from 'ethers';

async function understandTransactionTypes(): Promise<void> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const feeData = await provider.getFeeData();
  console.log('Current fee data:');
  console.log('  Gas Price:', ethers.formatUnits(feeData.gasPrice!, 'gwei'), 'gwei');
  console.log('  Max Fee:', ethers.formatUnits(feeData.maxFeePerGas!, 'gwei'), 'gwei');
  
  // EIP-1559 transaction (Type 2) - recommended
  const eip1559Tx: TransactionRequest = {
    to: '0x...',
    value: ethers.parseEther('0.01'),
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit: 21000n,
    type: 2
  };
  
  console.log('ethers.js defaults to EIP-1559 when available');
}

understandTransactionTypes().catch(console.error);`
        },
        expectedOutput: 'Current fee data:\n  Gas Price: 25.5 gwei\n  Max Fee: 30.0 gwei\n  Max Priority Fee: 1.5 gwei',
        hints: [
          'EIP-1559 is standard on Ethereum since London upgrade',
          'Some L2s still use legacy transactions'
        ]
      },
      {
        id: 'write-2',
        title: 'Sending ETH Transfers',
        description: 'Send native currency between addresses.',
        explanation: 'ETH transfers are the simplest transactions. Always check balance, estimate gas, and handle errors properly.',
        code: {
          javascript: `import { ethers } from 'ethers';

async function sendETH(toAddress, amountInEther) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const fromAddress = await signer.getAddress();
  
  // Parse amount
  const amount = ethers.parseEther(amountInEther);
  console.log('Sending', amountInEther, 'ETH to', toAddress);
  
  // Check balance
  const balance = await provider.getBalance(fromAddress);
  console.log('Current balance:', ethers.formatEther(balance), 'ETH');
  
  // Estimate gas
  const gasEstimate = await provider.estimateGas({
    to: toAddress,
    value: amount
  });
  
  // Get fee data
  const feeData = await provider.getFeeData();
  const maxCost = gasEstimate * feeData.maxFeePerGas;
  const totalNeeded = amount + maxCost;
  
  console.log('Estimated gas:', gasEstimate.toString());
  console.log('Max transaction cost:', ethers.formatEther(maxCost), 'ETH');
  
  // Check if we have enough
  if (balance < totalNeeded) {
    throw new Error(\`Insufficient funds. Need \${ethers.formatEther(totalNeeded)} ETH\`);
  }
  
  // Send transaction
  const tx = await signer.sendTransaction({
    to: toAddress,
    value: amount
    // Gas params will be auto-filled by ethers
  });
  
  console.log('Transaction sent!');
  console.log('Hash:', tx.hash);
  console.log('Nonce:', tx.nonce);
  
  // Wait for confirmation
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait(1); // Wait for 1 confirmation
  
  console.log('Confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  console.log('Effective gas price:', ethers.formatUnits(receipt.gasPrice, 'gwei'), 'gwei');
  
  // Calculate actual cost
  const actualCost = receipt.gasUsed * receipt.gasPrice;
  console.log('Actual cost:', ethers.formatEther(actualCost), 'ETH');
  
  return receipt;
}

// Usage
sendETH('0x...recipient...', '0.1').catch(console.error);`,
          typescript: `import { ethers, TransactionReceipt } from 'ethers';

async function sendETH(toAddress: string, amountInEther: string): Promise<TransactionReceipt | null> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const fromAddress = await signer.getAddress();
  
  const amount = ethers.parseEther(amountInEther);
  const balance = await provider.getBalance(fromAddress);
  
  const gasEstimate = await provider.estimateGas({
    to: toAddress,
    value: amount
  });
  
  const feeData = await provider.getFeeData();
  const maxCost = gasEstimate * feeData.maxFeePerGas!;
  const totalNeeded = amount + maxCost;
  
  if (balance < totalNeeded) {
    throw new Error(\`Insufficient funds. Need \${ethers.formatEther(totalNeeded)} ETH\`);
  }
  
  const tx = await signer.sendTransaction({
    to: toAddress,
    value: amount
  });
  
  console.log('Transaction sent! Hash:', tx.hash);
  
  const receipt = await tx.wait(1);
  console.log('Confirmed in block:', receipt?.blockNumber);
  
  return receipt;
}

sendETH('0x...recipient...', '0.1').catch(console.error);`
        },
        expectedOutput: 'Sending 0.1 ETH to 0x...\nTransaction sent!\nHash: 0x...\nConfirmed in block: 18500001',
        hints: [
          'Always check balance before sending',
          'wait(1) waits for 1 confirmation'
        ]
      },
      {
        id: 'write-3',
        title: 'Approving Token Spending',
        description: 'Approve contracts to spend your tokens.',
        explanation: 'Before a contract can transfer your tokens, you must approve it. This is a safety feature of ERC-20.',
        code: {
          javascript: `import { ethers } from 'ethers';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function approveTokenSpending(tokenAddress, spenderAddress, amount) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();
  
  // Connect to token contract
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  // Get token info
  const [symbol, decimals] = await Promise.all([
    token.symbol(),
    token.decimals()
  ]);
  
  // Check current allowance
  const currentAllowance = await token.allowance(userAddress, spenderAddress);
  console.log('Current allowance:', ethers.formatUnits(currentAllowance, decimals), symbol);
  
  // Parse amount (use MaxUint256 for unlimited)
  let approveAmount;
  if (amount === 'max' || amount === 'unlimited') {
    approveAmount = ethers.MaxUint256;
    console.log('Approving unlimited', symbol);
  } else {
    approveAmount = ethers.parseUnits(amount, decimals);
    console.log('Approving', amount, symbol);
  }
  
  // Estimate gas
  const gasEstimate = await token.approve.estimateGas(spenderAddress, approveAmount);
  console.log('Estimated gas:', gasEstimate.toString());
  
  // Send approval transaction
  const tx = await token.approve(spenderAddress, approveAmount);
  console.log('Approval sent:', tx.hash);
  
  // Wait for confirmation
  const receipt = await tx.wait();
  console.log('Approval confirmed!');
  
  // Verify new allowance
  const newAllowance = await token.allowance(userAddress, spenderAddress);
  console.log('New allowance:', ethers.formatUnits(newAllowance, decimals), symbol);
  
  return receipt;
}

// Approve Uniswap Router to spend USDC
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
approveTokenSpending(USDC, UNISWAP_ROUTER, '1000').catch(console.error);`,
          typescript: `import { ethers, TransactionReceipt } from 'ethers';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function approveTokenSpending(
  tokenAddress: string,
  spenderAddress: string,
  amount: string | 'max'
): Promise<TransactionReceipt | null> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();
  
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  const [symbol, decimals]: [string, bigint] = await Promise.all([
    token.symbol(),
    token.decimals()
  ]);
  
  let approveAmount: bigint;
  if (amount === 'max') {
    approveAmount = ethers.MaxUint256;
  } else {
    approveAmount = ethers.parseUnits(amount, decimals);
  }
  
  const tx = await token.approve(spenderAddress, approveAmount);
  console.log('Approval sent:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Approval confirmed!');
  
  return receipt;
}

approveTokenSpending(USDC, UNISWAP_ROUTER, '1000').catch(console.error);`
        },
        expectedOutput: 'Current allowance: 0.0 USDC\nApproving 1000 USDC\nApproval sent: 0x...\nApproval confirmed!',
        hints: [
          'MaxUint256 approval is convenient but less secure',
          'Some protocols prefer exact amount approvals'
        ]
      },
      {
        id: 'write-4',
        title: 'Transferring Tokens',
        description: 'Transfer ERC-20 tokens to another address.',
        explanation: 'Token transfers are contract calls, not native ETH transfers. They require gas in ETH even though you\'re sending tokens.',
        code: {
          javascript: `import { ethers } from 'ethers';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function transferTokens(tokenAddress, toAddress, amount) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const fromAddress = await signer.getAddress();
  
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  // Get token info
  const [symbol, decimals, balance] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.balanceOf(fromAddress)
  ]);
  
  console.log('Token:', symbol);
  console.log('Your balance:', ethers.formatUnits(balance, decimals), symbol);
  
  // Parse transfer amount
  const transferAmount = ethers.parseUnits(amount, decimals);
  
  // Check sufficient balance
  if (balance < transferAmount) {
    throw new Error(\`Insufficient \${symbol} balance\`);
  }
  
  // Check ETH for gas
  const ethBalance = await provider.getBalance(fromAddress);
  const gasEstimate = await token.transfer.estimateGas(toAddress, transferAmount);
  const feeData = await provider.getFeeData();
  const gasCost = gasEstimate * feeData.maxFeePerGas;
  
  if (ethBalance < gasCost) {
    throw new Error(\`Insufficient ETH for gas. Need \${ethers.formatEther(gasCost)} ETH\`);
  }
  
  console.log('Transferring', amount, symbol, 'to', toAddress);
  
  // Send transfer
  const tx = await token.transfer(toAddress, transferAmount);
  console.log('Transfer sent:', tx.hash);
  
  // Wait and get events
  const receipt = await tx.wait();
  
  // Parse Transfer event
  for (const log of receipt.logs) {
    try {
      const parsed = token.interface.parseLog(log);
      if (parsed.name === 'Transfer') {
        console.log('Transfer event:');
        console.log('  From:', parsed.args.from);
        console.log('  To:', parsed.args.to);
        console.log('  Amount:', ethers.formatUnits(parsed.args.value, decimals), symbol);
      }
    } catch (e) {
      // Not our event
    }
  }
  
  // Check new balance
  const newBalance = await token.balanceOf(fromAddress);
  console.log('New balance:', ethers.formatUnits(newBalance, decimals), symbol);
  
  return receipt;
}

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
transferTokens(USDC, '0x...recipient...', '100').catch(console.error);`,
          typescript: `import { ethers, TransactionReceipt, Log } from 'ethers';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function transferTokens(
  tokenAddress: string,
  toAddress: string,
  amount: string
): Promise<TransactionReceipt | null> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const fromAddress = await signer.getAddress();
  
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  
  const [symbol, decimals, balance]: [string, bigint, bigint] = await Promise.all([
    token.symbol(),
    token.decimals(),
    token.balanceOf(fromAddress)
  ]);
  
  const transferAmount = ethers.parseUnits(amount, decimals);
  
  if (balance < transferAmount) {
    throw new Error(\`Insufficient \${symbol} balance\`);
  }
  
  const tx = await token.transfer(toAddress, transferAmount);
  console.log('Transfer sent:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('Transfer confirmed!');
  
  return receipt;
}

transferTokens(USDC, '0x...recipient...', '100').catch(console.error);`
        },
        expectedOutput: 'Token: USDC\nYour balance: 1000.0 USDC\nTransferring 100 USDC\nTransfer sent: 0x...\nTransfer confirmed!',
        hints: [
          'Token transfers require ETH for gas',
          'Always check both token and ETH balance'
        ]
      },
      {
        id: 'write-5',
        title: 'Handling Transaction Errors',
        description: 'Properly handle transaction failures and reverts.',
        explanation: 'Transactions can fail for many reasons. Good error handling improves user experience and helps debugging.',
        code: {
          javascript: `import { ethers } from 'ethers';

// Common transaction errors and how to handle them
async function handleTransactionErrors() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Example contract call
  const contract = new ethers.Contract(
    '0x...',
    ['function riskyFunction() payable'],
    signer
  );
  
  try {
    // Simulate first (dry run)
    await contract.riskyFunction.staticCall({ value: ethers.parseEther('0.1') });
    console.log('Simulation passed!');
    
    // Send actual transaction
    const tx = await contract.riskyFunction({ value: ethers.parseEther('0.1') });
    const receipt = await tx.wait();
    console.log('Success!');
    
  } catch (error) {
    // Parse the error
    if (error.code === 'ACTION_REJECTED') {
      console.log('User rejected the transaction');
      return;
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('Not enough ETH for gas + value');
      return;
    }
    
    if (error.code === 'CALL_EXCEPTION') {
      // Transaction reverted
      console.log('Transaction would revert');
      console.log('Reason:', error.reason);
      console.log('Method:', error.method);
      
      // Try to decode custom error
      if (error.data) {
        try {
          const iface = contract.interface;
          const decoded = iface.parseError(error.data);
          console.log('Custom error:', decoded.name, decoded.args);
        } catch (e) {
          console.log('Raw error data:', error.data);
        }
      }
      return;
    }
    
    if (error.code === 'NONCE_EXPIRED') {
      console.log('Nonce already used. Transaction may be stuck.');
      return;
    }
    
    if (error.code === 'REPLACEMENT_UNDERPRICED') {
      console.log('Replacement tx gas too low. Increase gas price.');
      return;
    }
    
    if (error.code === 'TRANSACTION_REPLACED') {
      // Transaction was replaced (speed up or cancel)
      if (error.cancelled) {
        console.log('Transaction was cancelled');
      } else {
        console.log('Transaction was sped up');
        console.log('New hash:', error.replacement.hash);
        const receipt = await error.replacement.wait();
        console.log('Replacement confirmed!');
      }
      return;
    }
    
    // Unknown error
    console.error('Unexpected error:', error);
  }
}

// Speed up a pending transaction
async function speedUpTransaction(pendingTxHash) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Get original transaction
  const originalTx = await provider.getTransaction(pendingTxHash);
  if (!originalTx) throw new Error('Transaction not found');
  
  // Create replacement with higher gas
  const feeData = await provider.getFeeData();
  const newTx = await signer.sendTransaction({
    to: originalTx.to,
    value: originalTx.value,
    data: originalTx.data,
    nonce: originalTx.nonce, // Same nonce!
    maxFeePerGas: feeData.maxFeePerGas * 150n / 100n, // 50% higher
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 150n / 100n
  });
  
  console.log('Speed-up tx:', newTx.hash);
  return newTx;
}

handleTransactionErrors().catch(console.error);`,
          typescript: `import { ethers } from 'ethers';

async function handleTransactionErrors(): Promise<void> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const contract = new ethers.Contract(
    '0x...',
    ['function riskyFunction() payable'],
    signer
  );
  
  try {
    await contract.riskyFunction.staticCall({ value: ethers.parseEther('0.1') });
    const tx = await contract.riskyFunction({ value: ethers.parseEther('0.1') });
    await tx.wait();
    console.log('Success!');
    
  } catch (error: any) {
    if (error.code === 'ACTION_REJECTED') {
      console.log('User rejected the transaction');
      return;
    }
    
    if (error.code === 'CALL_EXCEPTION') {
      console.log('Transaction would revert');
      console.log('Reason:', error.reason);
      return;
    }
    
    if (error.code === 'TRANSACTION_REPLACED') {
      if (error.cancelled) {
        console.log('Transaction was cancelled');
      } else {
        console.log('Transaction was sped up');
        const receipt = await error.replacement.wait();
      }
      return;
    }
    
    console.error('Unexpected error:', error);
  }
}

handleTransactionErrors().catch(console.error);`
        },
        expectedOutput: 'Simulation passed!\nSuccess!',
        hints: [
          'Use staticCall to simulate before sending',
          'Handle user rejection gracefully'
        ]
      }
    ]
  },
  {
    id: 'react-web3-hooks',
    title: 'React Hooks for Web3',
    description: 'Build custom React hooks for wallet connection and blockchain interactions',
    category: 'web3-frontend',
    difficulty: 'intermediate',
    estimatedTime: '40 min',
    prerequisites: ['ethers-intro', 'reading-contracts'],
    languages: ['typescript'],
    steps: [
      {
        id: 'hooks-1',
        title: 'useWallet Hook',
        description: 'Create a hook for wallet connection state.',
        explanation: 'Custom hooks encapsulate Web3 logic and make it reusable across components. This hook manages wallet connection state.',
        code: {
          typescript: `import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Signer } from 'ethers';

interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  address: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: Signer | null;
  error: string | null;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    chainId: null,
    provider: null,
    signer: null,
    error: null
  });

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!window.ethereum) return;
      
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        
        setState({
          isConnected: true,
          isConnecting: false,
          address: accounts[0].address,
          chainId: Number(network.chainId),
          provider,
          signer,
          error: null
        });
      }
    };
    
    checkConnection();
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(prev => ({ ...prev, isConnected: false, address: null, signer: null }));
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setState(prev => ({ ...prev, chainId }));
      // Reload to ensure correct state
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(prev => ({ ...prev, error: 'Please install MetaMask' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setState({
        isConnected: true,
        isConnecting: false,
        address,
        chainId: Number(network.chainId),
        provider,
        signer,
        error: null
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Connection failed'
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      chainId: null,
      provider: null,
      signer: null,
      error: null
    });
  }, []);

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: \`0x\${chainId.toString(16)}\` }]
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not added, need to add it
        console.log('Chain not found, need to add it');
      }
      throw error;
    }
  }, []);

  return { ...state, connect, disconnect, switchChain };
}

// Usage in component:
// const { isConnected, address, connect, disconnect } = useWallet();`
        },
        expectedOutput: 'Hook created with connect, disconnect, and switchChain functions',
        hints: [
          'Always clean up event listeners in useEffect',
          'Handle the case where MetaMask is not installed'
        ]
      },
      {
        id: 'hooks-2',
        title: 'useBalance Hook',
        description: 'Create a hook for fetching and updating balances.',
        explanation: 'This hook fetches ETH balance and can auto-refresh. It demonstrates data fetching patterns for Web3.',
        code: {
          typescript: `import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider } from 'ethers';

interface UseBalanceOptions {
  address?: string;
  watch?: boolean;
  refreshInterval?: number;
}

interface UseBalanceReturn {
  balance: bigint | null;
  formatted: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBalance(options: UseBalanceOptions = {}): UseBalanceReturn {
  const { address, watch = false, refreshInterval = 10000 } = options;
  
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address || !window.ethereum) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(address);
      setBalance(bal);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch balance');
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Initial fetch
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Watch for changes (polling)
  useEffect(() => {
    if (!watch || !address) return;

    const interval = setInterval(fetchBalance, refreshInterval);
    return () => clearInterval(interval);
  }, [watch, address, refreshInterval, fetchBalance]);

  // Subscribe to new blocks for real-time updates
  useEffect(() => {
    if (!watch || !address || !window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);
    
    const handleBlock = () => {
      fetchBalance();
    };

    provider.on('block', handleBlock);
    return () => {
      provider.off('block', handleBlock);
    };
  }, [watch, address, fetchBalance]);

  return {
    balance,
    formatted: balance !== null ? ethers.formatEther(balance) : null,
    isLoading,
    error,
    refetch: fetchBalance
  };
}

// useTokenBalance for ERC-20 tokens
interface UseTokenBalanceOptions {
  tokenAddress: string;
  ownerAddress?: string;
  watch?: boolean;
}

export function useTokenBalance(options: UseTokenBalanceOptions) {
  const { tokenAddress, ownerAddress, watch = false } = options;
  
  const [balance, setBalance] = useState<bigint | null>(null);
  const [decimals, setDecimals] = useState<number>(18);
  const [symbol, setSymbol] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];

  const fetchTokenBalance = useCallback(async () => {
    if (!ownerAddress || !tokenAddress || !window.ethereum) return;

    setIsLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [bal, dec, sym] = await Promise.all([
        token.balanceOf(ownerAddress),
        token.decimals(),
        token.symbol()
      ]);

      setBalance(bal);
      setDecimals(Number(dec));
      setSymbol(sym);
    } catch (err) {
      console.error('Failed to fetch token balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ownerAddress, tokenAddress]);

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  return {
    balance,
    decimals,
    symbol,
    formatted: balance !== null ? ethers.formatUnits(balance, decimals) : null,
    isLoading,
    refetch: fetchTokenBalance
  };
}

// Usage:
// const { balance, formatted, isLoading } = useBalance({ address: '0x...', watch: true });
// const { balance: usdcBalance, symbol } = useTokenBalance({ tokenAddress: USDC, ownerAddress: '0x...' });`
        },
        expectedOutput: 'useBalance and useTokenBalance hooks created',
        hints: [
          'Watch mode uses block subscription for real-time updates',
          'Always format with correct decimals for tokens'
        ]
      },
      {
        id: 'hooks-3',
        title: 'useContract Hook',
        description: 'Create a hook for contract interactions.',
        explanation: 'This hook provides a typed interface for reading from and writing to contracts with loading and error states.',
        code: {
          typescript: `import { useState, useMemo, useCallback } from 'react';
import { ethers, Contract, BrowserProvider, InterfaceAbi } from 'ethers';

interface UseContractOptions {
  address: string;
  abi: InterfaceAbi;
  signerRequired?: boolean;
}

interface ContractCallOptions {
  value?: bigint;
  gasLimit?: bigint;
}

export function useContract<T extends Contract = Contract>(options: UseContractOptions) {
  const { address, abi, signerRequired = false } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create read-only contract instance
  const contract = useMemo(() => {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    return new ethers.Contract(address, abi, provider) as T;
  }, [address, abi]);

  // Read function (view/pure)
  const read = useCallback(async <R>(
    method: string,
    args: any[] = []
  ): Promise<R | null> => {
    if (!contract) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await contract[method](...args);
      return result as R;
    } catch (err: any) {
      setError(err.message || 'Read failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [contract]);

  // Write function (state-changing)
  const write = useCallback(async (
    method: string,
    args: any[] = [],
    options: ContractCallOptions = {}
  ) => {
    if (!window.ethereum) throw new Error('No wallet');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractWithSigner = new ethers.Contract(address, abi, signer);
      
      // Prepare transaction options
      const txOptions: any = {};
      if (options.value) txOptions.value = options.value;
      if (options.gasLimit) txOptions.gasLimit = options.gasLimit;
      
      // Send transaction
      const tx = await contractWithSigner[method](...args, txOptions);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      return receipt;
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, abi]);

  // Simulate (staticCall)
  const simulate = useCallback(async (
    method: string,
    args: any[] = [],
    options: ContractCallOptions = {}
  ) => {
    if (!window.ethereum) throw new Error('No wallet');
    
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contractWithSigner = new ethers.Contract(address, abi, signer);
    
    const txOptions: any = {};
    if (options.value) txOptions.value = options.value;
    
    return contractWithSigner[method].staticCall(...args, txOptions);
  }, [address, abi]);

  return {
    contract,
    read,
    write,
    simulate,
    isLoading,
    error
  };
}

// Usage example:
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

function TokenComponent() {
  const { read, write, isLoading, error } = useContract({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    abi: ERC20_ABI
  });

  const checkBalance = async () => {
    const balance = await read<bigint>('balanceOf', ['0x...']);
    console.log('Balance:', balance);
  };

  const sendTokens = async () => {
    try {
      const receipt = await write('transfer', ['0x...recipient', 1000000n]);
      console.log('Transfer confirmed:', receipt.hash);
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  return (
    <div>
      <button onClick={checkBalance} disabled={isLoading}>Check Balance</button>
      <button onClick={sendTokens} disabled={isLoading}>Send Tokens</button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}`
        },
        expectedOutput: 'useContract hook with read, write, and simulate functions',
        hints: [
          'Separate read (provider) from write (signer) operations',
          'Always use simulate before write for safety'
        ]
      },
      {
        id: 'hooks-4',
        title: 'useTransaction Hook',
        description: 'Track transaction status with pending, success, and error states.',
        explanation: 'This hook manages the full transaction lifecycle, providing feedback for each stage.',
        code: {
          typescript: `import { useState, useCallback } from 'react';
import { ethers, TransactionReceipt, TransactionResponse } from 'ethers';

type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

interface TransactionState {
  status: TransactionStatus;
  hash: string | null;
  receipt: TransactionReceipt | null;
  error: string | null;
  confirmations: number;
}

interface UseTransactionReturn extends TransactionState {
  sendTransaction: (txPromise: Promise<TransactionResponse>) => Promise<TransactionReceipt | null>;
  reset: () => void;
}

export function useTransaction(requiredConfirmations = 1): UseTransactionReturn {
  const [state, setState] = useState<TransactionState>({
    status: 'idle',
    hash: null,
    receipt: null,
    error: null,
    confirmations: 0
  });

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      hash: null,
      receipt: null,
      error: null,
      confirmations: 0
    });
  }, []);

  const sendTransaction = useCallback(async (
    txPromise: Promise<TransactionResponse>
  ): Promise<TransactionReceipt | null> => {
    setState(prev => ({ ...prev, status: 'pending', error: null }));

    try {
      // Wait for user to sign and broadcast
      const tx = await txPromise;
      
      setState(prev => ({
        ...prev,
        status: 'confirming',
        hash: tx.hash
      }));

      // Wait for confirmations
      const receipt = await tx.wait(requiredConfirmations);
      
      if (receipt) {
        setState({
          status: 'success',
          hash: tx.hash,
          receipt,
          error: null,
          confirmations: requiredConfirmations
        });
        return receipt;
      }
      
      throw new Error('Transaction failed');
    } catch (err: any) {
      const errorMessage = err.code === 'ACTION_REJECTED' 
        ? 'Transaction rejected by user'
        : err.reason || err.message || 'Transaction failed';
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      return null;
    }
  }, [requiredConfirmations]);

  return { ...state, sendTransaction, reset };
}

// TransactionButton component using the hook
interface TransactionButtonProps {
  onClick: () => Promise<TransactionResponse>;
  children: React.ReactNode;
}

function TransactionButton({ onClick, children }: TransactionButtonProps) {
  const { status, hash, error, sendTransaction, reset } = useTransaction();

  const handleClick = async () => {
    const receipt = await sendTransaction(onClick());
    if (receipt) {
      console.log('Success!', receipt);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'pending': return 'Sign in wallet...';
      case 'confirming': return 'Confirming...';
      case 'success': return 'Success! ✓';
      case 'error': return 'Try Again';
      default: return children;
    }
  };

  return (
    <div>
      <button
        onClick={status === 'error' ? reset : handleClick}
        disabled={status === 'pending' || status === 'confirming'}
        className={\`px-4 py-2 rounded \${
          status === 'success' ? 'bg-green-500' :
          status === 'error' ? 'bg-red-500' :
          'bg-blue-500'
        } text-white\`}
      >
        {getButtonText()}
      </button>
      
      {hash && (
        <a 
          href={\`https://etherscan.io/tx/\${hash}\`}
          target="_blank"
          className="text-sm text-blue-400 mt-2 block"
        >
          View on Etherscan ↗
        </a>
      )}
      
      {error && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}

// Usage:
// <TransactionButton onClick={() => contract.transfer(to, amount)}>
//   Send Tokens
// </TransactionButton>`
        },
        expectedOutput: 'useTransaction hook with status tracking and TransactionButton component',
        hints: [
          'Show different UI for each transaction stage',
          'Always provide a way to view on block explorer'
        ]
      },
      {
        id: 'hooks-5',
        title: 'useEvents Hook',
        description: 'Subscribe to and query smart contract events.',
        explanation: 'Events are crucial for tracking on-chain activity. This hook provides both historical queries and real-time subscriptions.',
        code: {
          typescript: `import { useState, useEffect, useCallback } from 'react';
import { ethers, Contract, BrowserProvider, Log, EventLog } from 'ethers';

interface UseEventsOptions {
  contractAddress: string;
  abi: string[];
  eventName: string;
  fromBlock?: number | 'latest';
  watch?: boolean;
}

interface ParsedEvent {
  blockNumber: number;
  transactionHash: string;
  args: Record<string, any>;
  timestamp?: number;
}

export function useEvents(options: UseEventsOptions) {
  const { contractAddress, abi, eventName, fromBlock = 'latest', watch = false } = options;
  
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query historical events
  const queryEvents = useCallback(async (from: number | 'latest' = fromBlock) => {
    if (!window.ethereum) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      // Get events
      const filter = contract.filters[eventName]();
      const logs = await contract.queryFilter(filter, from, 'latest');
      
      // Parse events with block info
      const parsedEvents: ParsedEvent[] = await Promise.all(
        logs.map(async (log) => {
          const eventLog = log as EventLog;
          const block = await provider.getBlock(log.blockNumber);
          
          return {
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            args: eventLog.args ? Object.fromEntries(
              Object.entries(eventLog.args).filter(([key]) => isNaN(Number(key)))
            ) : {},
            timestamp: block?.timestamp
          };
        })
      );
      
      setEvents(parsedEvents);
    } catch (err: any) {
      setError(err.message || 'Failed to query events');
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, abi, eventName, fromBlock]);

  // Initial query
  useEffect(() => {
    queryEvents();
  }, [queryEvents]);

  // Watch for new events
  useEffect(() => {
    if (!watch || !window.ethereum) return;
    
    const provider = new BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    const handleEvent = (...args: any[]) => {
      // Last argument is the event object
      const event = args[args.length - 1];
      
      const newEvent: ParsedEvent = {
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
        args: Object.fromEntries(
          Object.entries(event.args).filter(([key]) => isNaN(Number(key)))
        ),
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      setEvents(prev => [newEvent, ...prev]);
    };
    
    contract.on(eventName, handleEvent);
    
    return () => {
      contract.off(eventName, handleEvent);
    };
  }, [watch, contractAddress, abi, eventName]);

  return {
    events,
    isLoading,
    error,
    refetch: queryEvents
  };
}

// Usage example: Watch ERC-20 Transfer events
function TransferHistory({ tokenAddress }: { tokenAddress: string }) {
  const { events, isLoading } = useEvents({
    contractAddress: tokenAddress,
    abi: ['event Transfer(address indexed from, address indexed to, uint256 value)'],
    eventName: 'Transfer',
    fromBlock: -1000, // Last 1000 blocks
    watch: true
  });

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Recent Transfers</h3>
      {isLoading && <p>Loading...</p>}
      {events.map((event, i) => (
        <div key={i} className="p-2 bg-gray-800 rounded text-sm">
          <p>From: {event.args.from?.slice(0, 10)}...</p>
          <p>To: {event.args.to?.slice(0, 10)}...</p>
          <p>Amount: {ethers.formatUnits(event.args.value, 6)}</p>
          <a 
            href={\`https://etherscan.io/tx/\${event.transactionHash}\`}
            className="text-blue-400"
          >
            View TX ↗
          </a>
        </div>
      ))}
    </div>
  );
}`
        },
        expectedOutput: 'useEvents hook with historical queries and real-time subscriptions',
        hints: [
          'Be careful with large block ranges - use pagination',
          'Clean up event listeners to prevent memory leaks'
        ]
      }
    ]
  },
  {
    id: 'functions-modifiers',
    title: 'Functions and Modifiers',
    description: 'Master Solidity functions, visibility, and modifiers for access control',
    category: 'solidity-basics',
    difficulty: 'beginner',
    estimatedTime: '35 min',
    prerequisites: ['solidity-intro'],
    languages: ['solidity'],
    steps: [
      {
        id: 'func-1',
        title: 'Function Visibility',
        description: 'Understand public, private, internal, and external visibility.',
        explanation: 'Visibility determines who can call a function. Choosing the right visibility is crucial for security and gas optimization.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FunctionVisibility {
    uint256 private secretNumber = 42;
    
    // PUBLIC: Can be called internally and externally
    // - Generates a getter if applied to state variables
    // - Most flexible but may cost more gas
    function getPublicNumber() public view returns (uint256) {
        return secretNumber;
    }
    
    // PRIVATE: Only callable within THIS contract
    // - Not accessible by derived contracts
    // - Best for internal implementation details
    function _privateHelper() private pure returns (string memory) {
        return "I'm private!";
    }
    
    // INTERNAL: Callable within this contract AND derived contracts
    // - Like "protected" in other languages
    // - Good for base contract functionality
    function _internalHelper() internal pure returns (string memory) {
        return "I'm internal!";
    }
    
    // EXTERNAL: Only callable from outside the contract
    // - Cannot be called internally (use this.func() as workaround)
    // - More gas efficient for large calldata parameters
    function externalOnly(bytes calldata data) external pure returns (uint256) {
        return data.length;
    }
    
    // Demonstrating internal calls
    function demonstrateCalls() public view returns (string memory, string memory) {
        // Can call private and internal from within contract
        string memory priv = _privateHelper();
        string memory intern = _internalHelper();
        
        // To call external, must use this.externalOnly()
        // But that costs extra gas - avoid if possible
        
        return (priv, intern);
    }
}

// Derived contract to show inheritance visibility
contract DerivedContract is FunctionVisibility {
    function testInheritance() public pure returns (string memory) {
        // Can access internal
        return _internalHelper();
        
        // Cannot access private:
        // return _privateHelper(); // ERROR!
    }
}

// Visibility best practices:
// - Default to private/internal, expose only what's needed
// - Use external for functions only called from outside
// - Use internal for shared logic in inheritance hierarchies`
        },
        expectedOutput: 'Functions with different visibility levels deployed',
        hints: [
          'external is cheaper than public for calldata params',
          'private means only this contract, not derived contracts'
        ]
      },
      {
        id: 'func-2',
        title: 'Function Modifiers',
        description: 'Use state mutability modifiers: view, pure, and payable.',
        explanation: 'State mutability tells the compiler what the function does with blockchain state, enabling optimizations.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StateMutability {
    uint256 public counter;
    mapping(address => uint256) public balances;
    
    // VIEW: Reads state but doesn't modify
    // - Free to call from outside (no gas when not in a tx)
    // - Can read storage, can call other view/pure functions
    function getCounter() public view returns (uint256) {
        return counter;
    }
    
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    function getMultipleValues() public view returns (uint256, uint256) {
        return (counter, balances[msg.sender]);
    }
    
    // PURE: Neither reads nor modifies state
    // - Free to call from outside
    // - Great for utility functions
    function add(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b;
    }
    
    function calculateHash(string memory input) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(input));
    }
    
    function validateAddress(address addr) public pure returns (bool) {
        return addr != address(0);
    }
    
    // PAYABLE: Can receive ETH
    // - Required to accept msg.value
    // - No payable = auto-reject ETH
    function deposit() public payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
    }
    
    function depositWithMinimum() public payable {
        require(msg.value >= 0.01 ether, "Minimum 0.01 ETH");
        balances[msg.sender] += msg.value;
    }
    
    // DEFAULT (no modifier): Can modify state, cannot receive ETH
    function increment() public {
        counter++;
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    // Receive function: Called when ETH is sent without data
    receive() external payable {
        balances[msg.sender] += msg.value;
    }
    
    // Fallback: Called when no function matches or ETH sent with data
    fallback() external payable {
        balances[msg.sender] += msg.value;
    }
}

// Quick reference:
// view    = reads state, no modifications
// pure    = no state access at all
// payable = can receive ETH
// (none)  = can modify state, no ETH`
        },
        expectedOutput: 'Contract with view, pure, and payable functions',
        hints: [
          'view and pure functions are free when called externally',
          'payable functions should validate msg.value'
        ]
      },
      {
        id: 'func-3',
        title: 'Custom Modifiers',
        description: 'Create reusable modifiers for access control and validation.',
        explanation: 'Custom modifiers reduce code duplication and make access control patterns explicit and reusable.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CustomModifiers {
    address public owner;
    bool public paused;
    mapping(address => bool) public admins;
    mapping(address => uint256) public lastAction;
    
    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
    }
    
    // Basic owner check
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _; // This is where the function body executes
    }
    
    // Admin check
    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }
    
    // Pause check
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused, "Contract is not paused");
        _;
    }
    
    // Rate limiting (cooldown)
    modifier cooldown(uint256 time) {
        require(
            block.timestamp >= lastAction[msg.sender] + time,
            "Cooldown active"
        );
        _;
        lastAction[msg.sender] = block.timestamp;
    }
    
    // Value validation
    modifier costs(uint256 amount) {
        require(msg.value >= amount, "Insufficient payment");
        _;
        // Refund excess
        if (msg.value > amount) {
            payable(msg.sender).transfer(msg.value - amount);
        }
    }
    
    // Non-zero address check
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    // Multiple modifiers can be chained
    function sensitiveAction() 
        public 
        onlyOwner 
        whenNotPaused 
    {
        // Only owner, only when not paused
    }
    
    // Using modifiers with parameters
    function purchaseItem() 
        public 
        payable 
        whenNotPaused 
        costs(0.1 ether) 
        cooldown(1 hours) 
    {
        // Process purchase
    }
    
    // Admin functions
    function pause() public onlyOwner {
        paused = true;
    }
    
    function unpause() public onlyOwner {
        paused = false;
    }
    
    function addAdmin(address admin) 
        public 
        onlyOwner 
        validAddress(admin) 
    {
        admins[admin] = true;
    }
    
    function removeAdmin(address admin) public onlyOwner {
        admins[admin] = false;
    }
    
    function transferOwnership(address newOwner) 
        public 
        onlyOwner 
        validAddress(newOwner) 
    {
        owner = newOwner;
    }
}`
        },
        expectedOutput: 'Contract with custom access control modifiers',
        hints: [
          '_; marks where the function body executes',
          'Code before _; runs before, code after runs after'
        ]
      },
      {
        id: 'func-4',
        title: 'Function Overloading',
        description: 'Create multiple functions with the same name but different parameters.',
        explanation: 'Solidity supports function overloading, allowing the same function name with different parameter types.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FunctionOverloading {
    event Transferred(address indexed to, uint256 amount, string note);
    
    mapping(address => uint256) public balances;
    
    constructor() {
        balances[msg.sender] = 1000 ether;
    }
    
    // Transfer with just amount
    function transfer(address to, uint256 amount) public returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transferred(to, amount, "");
        return true;
    }
    
    // Transfer with note (different signature)
    function transfer(
        address to, 
        uint256 amount, 
        string calldata note
    ) public returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transferred(to, amount, note);
        return true;
    }
    
    // Transfer to multiple recipients
    function transfer(
        address[] calldata recipients, 
        uint256[] calldata amounts
    ) public returns (bool) {
        require(recipients.length == amounts.length, "Length mismatch");
        
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        require(balances[msg.sender] >= total, "Insufficient balance");
        
        balances[msg.sender] -= total;
        for (uint256 i = 0; i < recipients.length; i++) {
            balances[recipients[i]] += amounts[i];
            emit Transferred(recipients[i], amounts[i], "batch");
        }
        return true;
    }
    
    // Overloaded getters
    function getBalance() public view returns (uint256) {
        return balances[msg.sender];
    }
    
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    // Same name, different types
    function process(uint256 value) public pure returns (string memory) {
        return "Processing uint256";
    }
    
    function process(int256 value) public pure returns (string memory) {
        return "Processing int256";
    }
    
    function process(address value) public pure returns (string memory) {
        return "Processing address";
    }
    
    function process(bytes calldata value) public pure returns (string memory) {
        return "Processing bytes";
    }
}

// Note: Return types alone don't differentiate overloaded functions
// This would NOT compile:
// function getValue() public returns (uint256) { ... }
// function getValue() public returns (string memory) { ... } // ERROR!`
        },
        expectedOutput: 'Contract with overloaded transfer and getBalance functions',
        hints: [
          'Parameter types must differ for overloading',
          'Return types alone cannot differentiate overloads'
        ]
      },
      {
        id: 'func-5',
        title: 'Return Values and Errors',
        description: 'Handle function returns and custom errors.',
        explanation: 'Solidity supports multiple return values, named returns, and custom errors for gas-efficient error handling.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Custom errors (gas efficient!)
error InsufficientBalance(address user, uint256 available, uint256 required);
error Unauthorized(address caller, string action);
error InvalidInput(string reason);
error ZeroAddress();

contract ReturnsAndErrors {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
        balances[msg.sender] = 1000;
    }
    
    // Single return
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    // Multiple returns
    function getInfo(address user) public view returns (
        uint256 balance,
        bool isOwner,
        uint256 timestamp
    ) {
        return (balances[user], user == owner, block.timestamp);
    }
    
    // Named returns (auto-returned)
    function getStats() public view returns (
        uint256 totalUsers,
        uint256 contractBalance,
        address currentOwner
    ) {
        totalUsers = 100; // Just example
        contractBalance = address(this).balance;
        currentOwner = owner;
        // No explicit return needed!
    }
    
    // Mixed: named returns with explicit return
    function calculate(uint256 a, uint256 b) public pure returns (
        uint256 sum,
        uint256 product
    ) {
        sum = a + b;
        product = a * b;
        // Can still use explicit return
        return (sum, product);
    }
    
    // Using custom errors (cheaper than require strings!)
    function withdraw(uint256 amount) public {
        if (balances[msg.sender] < amount) {
            revert InsufficientBalance(
                msg.sender, 
                balances[msg.sender], 
                amount
            );
        }
        
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    function adminAction() public {
        if (msg.sender != owner) {
            revert Unauthorized(msg.sender, "adminAction");
        }
        // Do admin stuff
    }
    
    function validateInput(string calldata input) public pure returns (bool) {
        if (bytes(input).length == 0) {
            revert InvalidInput("Input cannot be empty");
        }
        if (bytes(input).length > 100) {
            revert InvalidInput("Input too long");
        }
        return true;
    }
    
    function setOwner(address newOwner) public {
        if (msg.sender != owner) {
            revert Unauthorized(msg.sender, "setOwner");
        }
        if (newOwner == address(0)) {
            revert ZeroAddress();
        }
        owner = newOwner;
    }
    
    // Destructuring returns when calling
    function demonstrateReturns() public view {
        // Get all values
        (uint256 bal, bool isOwn, uint256 ts) = getInfo(msg.sender);
        
        // Skip values you don't need
        (uint256 balance, , ) = getInfo(msg.sender);
        
        // Use directly
        require(getBalance(msg.sender) > 0, "No balance");
    }
}

// Gas comparison:
// require(condition, "Long error message")  = ~200+ gas for the string
// revert CustomError()                      = ~50 gas (just selector)`
        },
        expectedOutput: 'Contract with multiple returns and custom errors',
        hints: [
          'Custom errors save gas compared to require strings',
          'Named returns can make code more readable'
        ]
      }
    ]
  },
  {
    id: 'events-logging',
    title: 'Events and Logging',
    description: 'Emit events for off-chain tracking and create efficient logs',
    category: 'solidity-basics',
    difficulty: 'beginner',
    estimatedTime: '30 min',
    prerequisites: ['solidity-intro', 'functions-modifiers'],
    languages: ['solidity'],
    steps: [
      {
        id: 'events-1',
        title: 'Declaring and Emitting Events',
        description: 'Learn how to declare events and emit them.',
        explanation: 'Events are the primary way to log data on the blockchain. They\'re cheap to emit and can be queried by off-chain services.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EventBasics {
    // Declare events
    // Convention: Past tense (action happened)
    event Transfer(address from, address to, uint256 amount);
    event Approval(address owner, address spender, uint256 amount);
    event Deposit(address user, uint256 amount);
    event Withdrawal(address user, uint256 amount);
    
    // Events can have no parameters
    event ContractPaused();
    event ContractUnpaused();
    
    mapping(address => uint256) public balances;
    bool public paused;
    
    // Emit events when state changes
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        
        // Emit the event
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        
        emit Withdrawal(msg.sender, amount);
    }
    
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // Events are logged in the transaction receipt
        emit Transfer(msg.sender, to, amount);
    }
    
    function pause() public {
        paused = true;
        emit ContractPaused();
    }
    
    function unpause() public {
        paused = false;
        emit ContractUnpaused();
    }
}

// Events are stored in transaction logs:
// - Cheaper than storage (~375 gas vs ~20000 gas for new slot)
// - Not accessible from within contracts
// - Permanent and immutable
// - Perfect for frontend notifications and indexing`
        },
        expectedOutput: 'Contract with basic event declarations and emissions',
        hints: [
          'Events are much cheaper than storage',
          'Use events to notify frontends of state changes'
        ]
      },
      {
        id: 'events-2',
        title: 'Indexed Parameters',
        description: 'Use indexed parameters for efficient event filtering.',
        explanation: 'Indexed parameters allow efficient filtering of events. You can have up to 3 indexed parameters per event.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IndexedEvents {
    // Indexed parameters are searchable (up to 3 per event)
    event Transfer(
        address indexed from,    // Can filter by sender
        address indexed to,      // Can filter by recipient
        uint256 amount           // Not indexed, but still in log data
    );
    
    // Complex event with all 3 indexed slots
    event Trade(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    
    // Indexed value types vs reference types
    event UserAction(
        address indexed user,     // Stored as-is (20 bytes)
        bytes32 indexed dataHash, // Stored as-is (32 bytes)
        string indexed name       // Stored as keccak256 hash!
    );
    
    // Non-indexed reference types keep full data
    event DetailedLog(
        address indexed user,
        string message,           // Full string stored
        bytes data                // Full bytes stored
    );
    
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
    }
    
    function trade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) public {
        // Trading logic...
        
        emit Trade(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            block.timestamp
        );
    }
    
    function logAction(string calldata action) public {
        emit DetailedLog(msg.sender, action, "");
    }
}

// Querying indexed events (JavaScript/ethers.js):
// 
// // Filter transfers TO a specific address
// const filter = contract.filters.Transfer(null, recipientAddress);
// const events = await contract.queryFilter(filter);
// 
// // Filter transfers FROM a specific address
// const filter2 = contract.filters.Transfer(senderAddress);
// const events2 = await contract.queryFilter(filter2);
// 
// // Filter both from AND to
// const filter3 = contract.filters.Transfer(from, to);`
        },
        expectedOutput: 'Contract with indexed event parameters for efficient filtering',
        hints: [
          'Up to 3 indexed parameters per event',
          'Indexed strings/bytes are hashed, not stored fully'
        ]
      },
      {
        id: 'events-3',
        title: 'Anonymous Events',
        description: 'Understand anonymous events and their use cases.',
        explanation: 'Anonymous events don\'t include the event signature in the first topic. They\'re rarely used but save gas.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AnonymousEvents {
    // Normal event: topic0 = keccak256("Transfer(address,address,uint256)")
    event Transfer(address indexed from, address indexed to, uint256 amount);
    
    // Anonymous event: no topic0 (event signature)
    // Can have 4 indexed params instead of 3
    event AnonymousTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed amount,
        uint256 indexed timestamp  // 4th indexed param possible!
    ) anonymous;
    
    // Use case: Save gas when event signature isn't needed
    event Log(bytes32 indexed data) anonymous;
    
    function normalTransfer(address to, uint256 amount) public {
        emit Transfer(msg.sender, to, amount);
        // Topics: [event_sig_hash, from, to]
        // Data: amount
    }
    
    function anonymousTransfer(address to, uint256 amount) public {
        emit AnonymousTransfer(msg.sender, to, amount, block.timestamp);
        // Topics: [from, to, amount, timestamp]
        // Data: (none)
        // Saves gas on topic0!
    }
}

// Topic structure comparison:
// 
// Normal event (Transfer):
// topic[0] = keccak256("Transfer(address,address,uint256)")
// topic[1] = from address
// topic[2] = to address
// data = amount
// 
// Anonymous event:
// topic[0] = from address (no event signature!)
// topic[1] = to address
// topic[2] = amount
// topic[3] = timestamp (4th indexed possible)
// data = (empty)
//
// Trade-offs:
// + Anonymous saves ~375 gas (no topic0)
// + Can have 4 indexed params
// - Harder to query (need to know structure)
// - Not auto-decodable by explorers`
        },
        expectedOutput: 'Contract showing normal vs anonymous events',
        hints: [
          'Anonymous events allow 4 indexed parameters',
          'Anonymous events are harder to decode externally'
        ]
      },
      {
        id: 'events-4',
        title: 'Event Patterns',
        description: 'Common patterns for effective event logging.',
        explanation: 'Learn practical patterns for logging state changes, batches, and complex data structures.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EventPatterns {
    // Pattern 1: Before/After values for debugging
    event BalanceChanged(
        address indexed user,
        uint256 oldBalance,
        uint256 newBalance,
        string reason
    );
    
    // Pattern 2: Batch operations
    event BatchTransfer(
        address indexed from,
        uint256 totalAmount,
        uint256 recipientCount
    );
    
    // Individual events within batch for indexing
    event TransferInBatch(
        bytes32 indexed batchId,
        address indexed to,
        uint256 amount
    );
    
    // Pattern 3: Struct-like data via multiple events
    event OrderCreated(uint256 indexed orderId);
    event OrderDetails(
        uint256 indexed orderId,
        address maker,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // Pattern 4: State machine transitions
    enum Status { Pending, Active, Completed, Cancelled }
    event StatusChanged(
        uint256 indexed itemId,
        Status indexed oldStatus,
        Status indexed newStatus,
        address changedBy
    );
    
    mapping(address => uint256) public balances;
    uint256 public orderCount;
    mapping(uint256 => Status) public orderStatus;
    
    function deposit() public payable {
        uint256 oldBalance = balances[msg.sender];
        balances[msg.sender] += msg.value;
        
        emit BalanceChanged(
            msg.sender,
            oldBalance,
            balances[msg.sender],
            "deposit"
        );
    }
    
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) public {
        require(recipients.length == amounts.length, "Length mismatch");
        
        bytes32 batchId = keccak256(abi.encodePacked(
            msg.sender, 
            block.timestamp, 
            recipients.length
        ));
        
        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            balances[msg.sender] -= amounts[i];
            balances[recipients[i]] += amounts[i];
            total += amounts[i];
            
            emit TransferInBatch(batchId, recipients[i], amounts[i]);
        }
        
        emit BatchTransfer(msg.sender, total, recipients.length);
    }
    
    function createOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) public returns (uint256) {
        uint256 orderId = ++orderCount;
        orderStatus[orderId] = Status.Pending;
        
        // Two events for complex data
        emit OrderCreated(orderId);
        emit OrderDetails(orderId, msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        
        return orderId;
    }
    
    function activateOrder(uint256 orderId) public {
        Status old = orderStatus[orderId];
        orderStatus[orderId] = Status.Active;
        
        emit StatusChanged(orderId, old, Status.Active, msg.sender);
    }
}`
        },
        expectedOutput: 'Contract with practical event patterns',
        hints: [
          'Log before/after values for debugging',
          'Use batch IDs to correlate related events'
        ]
      },
      {
        id: 'events-5',
        title: 'Querying Events from Frontend',
        description: 'How to listen and query events from JavaScript.',
        explanation: 'Events are powerful for building reactive frontends. Learn to subscribe and query historical events.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// The Solidity contract with events
contract EventDemo {
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount, block.timestamp);
    }
    
    function mint(address to, uint256 amount) public {
        balances[to] += amount;
        emit Mint(to, amount);
    }
}

/*
// JavaScript/TypeScript code to query and listen to events:

import { ethers } from 'ethers';

const provider = new ethers.BrowserProvider(window.ethereum);
const contract = new ethers.Contract(address, abi, provider);

// 1. Listen for new events (real-time)
contract.on('Transfer', (from, to, amount, timestamp, event) => {
    console.log('New Transfer:');
    console.log('  From:', from);
    console.log('  To:', to);
    console.log('  Amount:', ethers.formatEther(amount));
    console.log('  Block:', event.log.blockNumber);
    console.log('  TX Hash:', event.log.transactionHash);
});

// 2. Query historical events
async function getTransferHistory(userAddress) {
    // Get transfers FROM user
    const sentFilter = contract.filters.Transfer(userAddress);
    const sent = await contract.queryFilter(sentFilter, -10000); // Last 10k blocks
    
    // Get transfers TO user
    const receivedFilter = contract.filters.Transfer(null, userAddress);
    const received = await contract.queryFilter(receivedFilter, -10000);
    
    console.log('Sent:', sent.length, 'Received:', received.length);
    
    // Parse events
    for (const event of sent) {
        console.log({
            to: event.args.to,
            amount: ethers.formatEther(event.args.amount),
            block: event.blockNumber
        });
    }
}

// 3. Get events from specific block range
async function getRecentActivity() {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock - 1000;
    
    const events = await contract.queryFilter('Transfer', fromBlock, latestBlock);
    console.log(\`Found \${events.length} transfers in last 1000 blocks\`);
}

// 4. Remove listeners when done
function cleanup() {
    contract.removeAllListeners('Transfer');
}
*/`
        },
        expectedOutput: 'Contract with events and JavaScript query examples',
        hints: [
          'Use queryFilter for historical events',
          'Remember to remove listeners to prevent memory leaks'
        ]
      }
    ]
  },
  {
    id: 'inheritance-interfaces',
    title: 'Inheritance and Interfaces',
    description: 'Master contract inheritance, interfaces, and abstract contracts in Solidity',
    category: 'solidity-basics',
    difficulty: 'intermediate',
    estimatedTime: '40 min',
    prerequisites: ['solidity-intro', 'functions-modifiers'],
    languages: ['solidity'],
    steps: [
      {
        id: 'inherit-1',
        title: 'Basic Inheritance',
        description: 'Create contracts that inherit from other contracts.',
        explanation: 'Solidity supports single and multiple inheritance. Child contracts can override parent functions and access internal members.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Base contract
contract Ownable {
    address public owner;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

// Child contract inherits from Ownable
contract MyToken is Ownable {
    string public name = "MyToken";
    mapping(address => uint256) public balances;
    
    // Constructor automatically calls parent constructor
    constructor() {
        // Ownable() is called automatically
        balances[msg.sender] = 1000000;
    }
    
    // Use inherited modifier
    function mint(address to, uint256 amount) public onlyOwner {
        balances[to] += amount;
    }
    
    // Access inherited owner variable
    function isOwner(address addr) public view returns (bool) {
        return addr == owner;
    }
}

// Another base contract
contract Pausable is Ownable {
    bool public paused;
    
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused, "Contract not paused");
        _;
    }
    
    function pause() public onlyOwner {
        paused = true;
    }
    
    function unpause() public onlyOwner {
        paused = false;
    }
}

// Multiple inheritance
contract PausableToken is Pausable {
    mapping(address => uint256) public balances;
    
    constructor() {
        balances[msg.sender] = 1000000;
    }
    
    function transfer(address to, uint256 amount) public whenNotPaused {
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}`
        },
        expectedOutput: 'Contracts demonstrating single and multiple inheritance',
        hints: [
          'Use "is" keyword to inherit',
          'Parent constructors are called automatically if no parameters'
        ]
      },
      {
        id: 'inherit-2',
        title: 'Function Overriding',
        description: 'Override parent functions with virtual and override keywords.',
        explanation: 'Functions marked virtual can be overridden by child contracts using the override keyword.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Animal {
    string public name;
    
    constructor(string memory _name) {
        name = _name;
    }
    
    // virtual = can be overridden
    function speak() public virtual pure returns (string memory) {
        return "...";
    }
    
    function move() public virtual pure returns (string memory) {
        return "moving";
    }
    
    // Not virtual = cannot be overridden
    function breathe() public pure returns (string memory) {
        return "breathing";
    }
}

contract Dog is Animal {
    // Call parent constructor
    constructor() Animal("Dog") {}
    
    // override = overriding parent function
    function speak() public pure override returns (string memory) {
        return "Woof!";
    }
    
    function move() public pure override returns (string memory) {
        return "running";
    }
}

contract Cat is Animal {
    constructor() Animal("Cat") {}
    
    function speak() public pure override returns (string memory) {
        return "Meow!";
    }
    
    // virtual + override = can be overridden again
    function move() public virtual pure override returns (string memory) {
        return "prowling";
    }
}

// Further inheritance
contract Kitten is Cat {
    function move() public pure override returns (string memory) {
        return "tumbling";
    }
}

// Multiple inheritance with same function
contract A {
    function foo() public virtual pure returns (string memory) {
        return "A";
    }
}

contract B {
    function foo() public virtual pure returns (string memory) {
        return "B";
    }
}

// Must override explicitly when inheriting from multiple contracts with same function
contract C is A, B {
    // Must specify all parents being overridden
    function foo() public pure override(A, B) returns (string memory) {
        return "C";
    }
}

// Call parent implementation
contract D is A {
    function foo() public pure override returns (string memory) {
        string memory parentResult = super.foo(); // Calls A.foo()
        return string.concat(parentResult, " -> D");
    }
}`
        },
        expectedOutput: 'Contracts showing function overriding with virtual/override',
        hints: [
          'virtual allows overriding, override indicates overriding',
          'super.functionName() calls the parent implementation'
        ]
      },
      {
        id: 'inherit-3',
        title: 'Interfaces',
        description: 'Define and implement interfaces for contract interaction.',
        explanation: 'Interfaces define what functions a contract must implement without providing implementation. They enable type-safe contract interactions.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Interface definition
// - No state variables (except constants)
// - No constructor
// - All functions are implicitly virtual and external
// - Cannot inherit from non-interfaces
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// Implementing an interface
contract MyToken is IERC20 {
    string public name = "MyToken";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    
    constructor() {
        _totalSupply = 1000000 * 10**18;
        _balances[msg.sender] = _totalSupply;
    }
    
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }
    
    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// Using interfaces to interact with external contracts
contract TokenSwap {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external {
        // Cast addresses to IERC20 interface
        IERC20 tIn = IERC20(tokenIn);
        IERC20 tOut = IERC20(tokenOut);
        
        // Now we can call ERC20 functions
        tIn.transferFrom(msg.sender, address(this), amount);
        tOut.transfer(msg.sender, amount);
    }
    
    function getBalance(address token, address user) external view returns (uint256) {
        return IERC20(token).balanceOf(user);
    }
}`
        },
        expectedOutput: 'Interface definition and implementation',
        hints: [
          'Interfaces enable type-safe external contract calls',
          'All interface functions must be implemented'
        ]
      },
      {
        id: 'inherit-4',
        title: 'Abstract Contracts',
        description: 'Create abstract contracts with partial implementations.',
        explanation: 'Abstract contracts can have unimplemented functions and cannot be deployed directly. They serve as templates for other contracts.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Abstract contract: has at least one unimplemented function
// Cannot be deployed directly
abstract contract ERC20Base {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    
    mapping(address => uint256) internal _balances;
    uint256 internal _totalSupply;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }
    
    // Implemented function
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    // Abstract function: no implementation
    // Must be implemented by child contracts
    function _mint(address to, uint256 amount) internal virtual;
    
    // Another abstract function
    function maxSupply() public view virtual returns (uint256);
}

// Concrete implementation
contract MyToken is ERC20Base {
    uint256 private _maxSupply;
    address public owner;
    
    constructor() ERC20Base("MyToken", "MTK") {
        owner = msg.sender;
        _maxSupply = 1000000 * 10**18;
        _mint(msg.sender, 100000 * 10**18); // Initial mint
    }
    
    // Implement abstract function
    function _mint(address to, uint256 amount) internal override {
        require(_totalSupply + amount <= _maxSupply, "Max supply exceeded");
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    
    // Implement abstract function
    function maxSupply() public view override returns (uint256) {
        return _maxSupply;
    }
    
    // Add new functionality
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        _mint(to, amount);
    }
}

// Another implementation with different behavior
contract CappedToken is ERC20Base {
    uint256 public immutable cap;
    
    constructor(uint256 _cap) ERC20Base("CappedToken", "CAP") {
        cap = _cap;
    }
    
    function _mint(address to, uint256 amount) internal override {
        require(_totalSupply + amount <= cap, "Cap exceeded");
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function maxSupply() public view override returns (uint256) {
        return cap;
    }
}`
        },
        expectedOutput: 'Abstract contract with multiple implementations',
        hints: [
          'Abstract contracts cannot be deployed directly',
          'Use abstract for partial implementations'
        ]
      },
      {
        id: 'inherit-5',
        title: 'Diamond Inheritance',
        description: 'Handle multiple inheritance and the diamond problem.',
        explanation: 'Solidity uses C3 linearization to resolve multiple inheritance. Understanding this is crucial for complex contract hierarchies.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// The "Diamond Problem" in multiple inheritance
//
//        A
//       / \\
//      B   C
//       \\ /
//        D

contract A {
    event Log(string message);
    
    function foo() public virtual {
        emit Log("A.foo");
    }
}

contract B is A {
    function foo() public virtual override {
        emit Log("B.foo");
        super.foo(); // Calls A.foo
    }
}

contract C is A {
    function foo() public virtual override {
        emit Log("C.foo");
        super.foo(); // Calls A.foo
    }
}

// D inherits from B and C (both inherit from A)
// Order matters! Right-most parent is most base-like
contract D is B, C {
    function foo() public override(B, C) {
        emit Log("D.foo");
        super.foo(); // Calls C.foo, then B.foo, then A.foo
    }
    // Output: D.foo, C.foo, B.foo, A.foo
    // Note: A.foo is only called once!
}

// C3 Linearization
// The order of inheritance determines the Method Resolution Order (MRO)
// D is B, C => MRO: D -> C -> B -> A
// D is C, B => MRO: D -> B -> C -> A

contract E is C, B {
    function foo() public override(B, C) {
        emit Log("E.foo");
        super.foo();
    }
    // Output: E.foo, B.foo, C.foo, A.foo
}

// Constructor order in multiple inheritance
contract Base1 {
    uint256 public value1;
    constructor(uint256 _v) {
        value1 = _v;
    }
}

contract Base2 {
    uint256 public value2;
    constructor(uint256 _v) {
        value2 = _v;
    }
}

// Constructors are called in order of inheritance declaration
contract Child is Base1, Base2 {
    // Option 1: Pass values directly
    constructor() Base1(1) Base2(2) {
        // Base1 constructor runs first, then Base2
    }
}

// Option 2: Pass constructor arguments
contract Child2 is Base1, Base2 {
    constructor(uint256 v1, uint256 v2) Base1(v1) Base2(v2) {}
}

// Best practices for multiple inheritance:
// 1. List base contracts from most base-like to most derived
// 2. Use super to call up the inheritance chain
// 3. Be explicit with override(Parent1, Parent2)
// 4. Keep inheritance hierarchies as simple as possible`
        },
        expectedOutput: 'Contracts demonstrating diamond inheritance resolution',
        hints: [
          'Order of inheritance matters for super calls',
          'C3 linearization ensures each parent is called once'
        ]
      }
    ]
  },
  {
    id: 'error-handling',
    title: 'Error Handling',
    description: 'Master require, revert, assert, and custom errors in Solidity',
    category: 'solidity-basics',
    difficulty: 'beginner',
    estimatedTime: '30 min',
    prerequisites: ['solidity-intro', 'functions-modifiers'],
    languages: ['solidity'],
    steps: [
      {
        id: 'error-1',
        title: 'Require Statements',
        description: 'Validate inputs and conditions with require.',
        explanation: 'require() is the most common way to validate conditions. It reverts if the condition is false and refunds remaining gas.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RequireExamples {
    address public owner;
    uint256 public value;
    mapping(address => uint256) public balances;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Basic require - check condition, revert with message if false
    function setValue(uint256 newValue) public {
        require(newValue > 0, "Value must be positive");
        require(newValue <= 1000, "Value too large");
        value = newValue;
    }
    
    // Multiple conditions
    function transfer(address to, uint256 amount) public {
        require(to != address(0), "Cannot transfer to zero address");
        require(amount > 0, "Amount must be positive");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
    
    // Access control
    function adminFunction() public {
        require(msg.sender == owner, "Only owner can call");
        // Admin logic...
    }
    
    // Payment validation
    function deposit() public payable {
        require(msg.value > 0, "Must send ETH");
        require(msg.value >= 0.01 ether, "Minimum 0.01 ETH");
        balances[msg.sender] += msg.value;
    }
    
    // Require without message (saves gas, but less helpful)
    function quickCheck(uint256 x) public pure returns (uint256) {
        require(x != 0);
        return 100 / x;
    }
    
    // Compound conditions
    function complexCheck(uint256 a, uint256 b) public pure returns (uint256) {
        require(a > 0 && b > 0, "Both must be positive");
        require(a != b, "Values must differ");
        return a + b;
    }
}

// require() behavior:
// - Reverts transaction if condition is false
// - Refunds remaining gas
// - Can include error message (costs more gas)
// - Use for: input validation, access control, state checks`
        },
        expectedOutput: 'Contract with require statement examples',
        hints: [
          'require refunds remaining gas on failure',
          'Error messages cost extra gas but help debugging'
        ]
      },
      {
        id: 'error-2',
        title: 'Custom Errors',
        description: 'Use gas-efficient custom errors with revert.',
        explanation: 'Custom errors (Solidity 0.8.4+) are more gas-efficient than require strings and can include parameters.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Define custom errors at contract level or file level
error Unauthorized(address caller, address required);
error InsufficientBalance(uint256 available, uint256 required);
error InvalidAmount(uint256 amount, string reason);
error ZeroAddress();
error Expired(uint256 deadline, uint256 currentTime);
error AlreadyInitialized();

contract CustomErrors {
    address public owner;
    mapping(address => uint256) public balances;
    bool public initialized;
    
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized(msg.sender, owner);
        }
        _;
    }
    
    function initialize(address _owner) external {
        if (initialized) {
            revert AlreadyInitialized();
        }
        if (_owner == address(0)) {
            revert ZeroAddress();
        }
        owner = _owner;
        initialized = true;
    }
    
    function withdraw(uint256 amount) external {
        if (amount == 0) {
            revert InvalidAmount(amount, "Amount cannot be zero");
        }
        
        uint256 balance = balances[msg.sender];
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }
        
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
    
    function claimReward(uint256 deadline) external {
        if (block.timestamp > deadline) {
            revert Expired(deadline, block.timestamp);
        }
        // Claim logic...
    }
    
    function adminWithdraw(uint256 amount) external onlyOwner {
        if (address(this).balance < amount) {
            revert InsufficientBalance(address(this).balance, amount);
        }
        payable(owner).transfer(amount);
    }
}

// Gas comparison:
// require(condition, "Insufficient balance")     ~500+ gas for string
// revert InsufficientBalance(available, required)  ~150 gas
// 
// Custom errors also provide structured error data that
// frontends can decode and display meaningfully`
        },
        expectedOutput: 'Contract using custom errors for gas efficiency',
        hints: [
          'Custom errors save 50%+ gas over require strings',
          'Error parameters help with debugging'
        ]
      },
      {
        id: 'error-3',
        title: 'Assert vs Require',
        description: 'Understand when to use assert vs require.',
        explanation: 'assert() is for checking invariants that should never be false. Use require() for input validation and assert() for internal errors.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AssertVsRequire {
    uint256 public totalSupply;
    mapping(address => uint256) public balances;
    
    // REQUIRE: For input validation and expected failures
    // - User errors (bad input, insufficient balance)
    // - Access control
    // - External conditions
    // - Refunds remaining gas
    
    // ASSERT: For invariant checking
    // - Internal errors that should never happen
    // - Post-condition verification
    // - Overflow checks (pre-0.8, now automatic)
    // - In 0.8+: Also refunds gas, but use Panic error code
    
    function transfer(address to, uint256 amount) public {
        // REQUIRE: Validate user input
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        uint256 senderBefore = balances[msg.sender];
        uint256 recipientBefore = balances[to];
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        
        // ASSERT: Verify invariant (should NEVER fail if code is correct)
        assert(balances[msg.sender] == senderBefore - amount);
        assert(balances[to] == recipientBefore + amount);
        
        // Assert total supply unchanged
        // (This is an invariant - if it fails, there's a bug)
        assert(balances[msg.sender] + balances[to] == senderBefore + recipientBefore);
    }
    
    function mint(address to, uint256 amount) public {
        require(to != address(0), "Cannot mint to zero");
        require(amount > 0, "Amount must be positive");
        
        uint256 supplyBefore = totalSupply;
        
        totalSupply += amount;
        balances[to] += amount;
        
        // Invariant: totalSupply should match what we added
        assert(totalSupply == supplyBefore + amount);
    }
    
    function burn(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        totalSupply -= amount;
        
        // Invariant: balance can't exceed total supply
        assert(balances[msg.sender] <= totalSupply);
    }
}

// Summary:
// require(): Expected failures, bad user input, access control
// assert(): Unexpected failures, invariant violations, bugs
// revert CustomError(): Gas-efficient alternative to require()`
        },
        expectedOutput: 'Contract demonstrating assert vs require usage',
        hints: [
          'Use assert for invariants that should never be false',
          'Use require for validating inputs and conditions'
        ]
      },
      {
        id: 'error-4',
        title: 'Try-Catch',
        description: 'Handle errors from external calls gracefully.',
        explanation: 'try-catch allows handling errors from external contract calls and contract creation without reverting the whole transaction.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IExternalContract {
    function riskyOperation(uint256 value) external returns (uint256);
    function getData() external view returns (string memory);
}

// Example external contract that might fail
contract RiskyContract {
    function riskyOperation(uint256 value) external pure returns (uint256) {
        require(value > 10, "Value too low");
        return value * 2;
    }
    
    function getData() external pure returns (string memory) {
        return "Hello";
    }
}

contract TryCatchExample {
    event CallSucceeded(uint256 result);
    event CallFailed(string reason);
    event CallFailedWithPanic(uint256 code);
    event CallFailedLowLevel(bytes data);
    
    IExternalContract public externalContract;
    
    constructor(address _external) {
        externalContract = IExternalContract(_external);
    }
    
    function safeCall(uint256 value) public returns (uint256) {
        try externalContract.riskyOperation(value) returns (uint256 result) {
            // Success case
            emit CallSucceeded(result);
            return result;
        } catch Error(string memory reason) {
            // require() or revert() with message
            emit CallFailed(reason);
            return 0;
        } catch Panic(uint256 errorCode) {
            // assert() failure or overflow/underflow
            // Common codes: 0x01 = assert, 0x11 = overflow, 0x12 = div by zero
            emit CallFailedWithPanic(errorCode);
            return 0;
        } catch (bytes memory lowLevelData) {
            // Custom error or unknown error
            emit CallFailedLowLevel(lowLevelData);
            return 0;
        }
    }
    
    // Simpler try-catch (just catch all errors)
    function simpleCall(uint256 value) public returns (bool success, uint256 result) {
        try externalContract.riskyOperation(value) returns (uint256 res) {
            return (true, res);
        } catch {
            return (false, 0);
        }
    }
    
    // Try-catch with contract creation
    function createContract() public returns (address) {
        try new RiskyContract() returns (RiskyContract newContract) {
            return address(newContract);
        } catch {
            return address(0);
        }
    }
    
    // Fallback pattern for unreliable external calls
    function robustFetch() public view returns (string memory) {
        try externalContract.getData() returns (string memory data) {
            return data;
        } catch {
            return "Fallback data";
        }
    }
}

// Notes:
// - try-catch only works for external calls
// - Cannot catch errors in internal functions
// - Useful for: oracles, multi-contract systems, optional features`
        },
        expectedOutput: 'Contract with try-catch error handling',
        hints: [
          'try-catch only works for external calls',
          'Panic codes indicate assertion failures or overflows'
        ]
      },
      {
        id: 'error-5',
        title: 'Error Handling Patterns',
        description: 'Common patterns for robust error handling.',
        explanation: 'Learn patterns for handling errors in production contracts: validation, graceful degradation, and error recovery.',
        code: {
          solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Custom errors for the contract
error InvalidInput(string param, string reason);
error OperationFailed(string operation);
error Unauthorized();
error ContractPaused();

contract ErrorPatterns {
    address public owner;
    bool public paused;
    mapping(address => uint256) public balances;
    
    event OperationResult(bool success, bytes data);
    
    constructor() {
        owner = msg.sender;
    }
    
    // Pattern 1: Guard pattern with early returns
    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidInput("address", "zero address");
        _;
    }
    
    modifier notPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // Pattern 2: Validate-then-execute
    function safeTransfer(address to, uint256 amount) 
        external 
        notPaused 
        validAddress(to) 
    {
        // All validation first
        if (amount == 0) revert InvalidInput("amount", "must be positive");
        if (balances[msg.sender] < amount) {
            revert InvalidInput("amount", "insufficient balance");
        }
        
        // Then execute
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
    
    // Pattern 3: Return success/failure instead of reverting
    function tryTransfer(address to, uint256 amount) 
        external 
        returns (bool success, string memory error) 
    {
        if (paused) return (false, "Contract is paused");
        if (to == address(0)) return (false, "Invalid recipient");
        if (amount == 0) return (false, "Invalid amount");
        if (balances[msg.sender] < amount) return (false, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return (true, "");
    }
    
    // Pattern 4: Batch operations with partial failure handling
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external returns (uint256 successCount, uint256 failCount) {
        require(recipients.length == amounts.length, "Length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) {
                failCount++;
                continue;
            }
            if (balances[msg.sender] < amounts[i]) {
                failCount++;
                continue;
            }
            
            balances[msg.sender] -= amounts[i];
            balances[recipients[i]] += amounts[i];
            successCount++;
        }
    }
    
    // Pattern 5: Safe external calls with fallback
    function safeExternalCall(address target, bytes calldata data) 
        external 
        onlyOwner 
        returns (bool) 
    {
        (bool success, bytes memory returnData) = target.call(data);
        
        emit OperationResult(success, returnData);
        
        if (!success) {
            // Don't revert, just return false
            return false;
        }
        
        return true;
    }
    
    // Pattern 6: Recoverable state
    mapping(address => uint256) public pendingWithdrawals;
    
    function initiateWithdrawal(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        pendingWithdrawals[msg.sender] += amount;
    }
    
    function completeWithdrawal() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            // Restore state if transfer fails
            pendingWithdrawals[msg.sender] = amount;
            revert OperationFailed("withdrawal");
        }
    }
}`
        },
        expectedOutput: 'Contract with production error handling patterns',
        hints: [
          'Consider returning success/failure for non-critical operations',
          'Batch operations can handle partial failures gracefully'
        ]
      }
    ]
  }
];
