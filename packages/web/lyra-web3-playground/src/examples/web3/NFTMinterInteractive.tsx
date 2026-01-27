/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 May your builds always succeed 🍀
 */

import { useState } from 'react';
import SplitView from '@/components/Playground/SplitView';
import MultiLanguageTabs, { LanguageTab } from '@/components/Playground/MultiLanguageTabs';
import InteractiveTutorial, { TutorialStep } from '@/components/Playground/InteractiveTutorial';
import ChallengeSystem, { Challenge } from '@/components/Playground/ChallengeSystem';
import { Code2, Zap } from 'lucide-react';

export default function NFTMinterInteractive() {
  const [viewMode, setViewMode] = useState<'tutorial' | 'challenge'>('tutorial');

  const [tabs, setTabs] = useState<LanguageTab[]>([
    {
      id: 'solidity',
      label: 'Smart Contract',
      language: 'solidity',
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Maximum supply
    uint256 public constant MAX_SUPPLY = 10000;
    
    // Mint price
    uint256 public mintPrice = 0.01 ether;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    constructor() ERC721("MyNFT", "MNFT") {}
    
    // Mint a new NFT
    function mint(address to, string memory tokenURI) 
        public 
        payable 
        returns (uint256) 
    {
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        emit NFTMinted(to, newTokenId, tokenURI);
        
        return newTokenId;
    }
    
    // Get total minted
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }
    
    // Update mint price (owner only)
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
    }
    
    // Withdraw funds (owner only)
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
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
}`
    },
    {
      id: 'javascript',
      label: 'Frontend (ethers.js)',
      language: 'javascript',
      code: `import { ethers } from 'ethers';

// Contract ABI (simplified for demo)
const NFT_ABI = [
  "function mint(address to, string memory tokenURI) payable returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI)"
];

const CONTRACT_ADDRESS = "0x..."; // Your deployed contract

class NFTMinter {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }
  
  // Connect to wallet
  async connect() {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
    
    this.provider = new ethers.BrowserProvider(window.ethereum);
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();
    this.contract = new ethers.Contract(
      this.contractAddress,
      NFT_ABI,
      this.signer
    );
    
    return await this.signer.getAddress();
  }
  
  // Get mint price
  async getMintPrice() {
    const price = await this.contract.mintPrice();
    return ethers.formatEther(price);
  }
  
  // Get total minted
  async getTotalSupply() {
    const supply = await this.contract.totalSupply();
    return supply.toString();
  }
  
  // Upload metadata to IPFS (simplified)
  async uploadToIPFS(metadata) {
    // In production, use Pinata, Infura, or similar
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer YOUR_PINATA_JWT\`
      },
      body: JSON.stringify(metadata)
    });
    
    const data = await response.json();
    return \`ipfs://\${data.IpfsHash}\`;
  }
  
  // Mint NFT
  async mint(name, description, imageUrl) {
    try {
      // 1. Create metadata
      const metadata = {
        name: name,
        description: description,
        image: imageUrl,
        attributes: [
          { trait_type: "Created", value: new Date().toISOString() }
        ]
      };
      
      // 2. Upload to IPFS
      console.log("Uploading metadata to IPFS...");
      const tokenURI = await this.uploadToIPFS(metadata);
      
      // 3. Get mint price
      const mintPrice = await this.contract.mintPrice();
      
      // 4. Mint NFT
      console.log("Minting NFT...");
      const tx = await this.contract.mint(
        await this.signer.getAddress(),
        tokenURI,
        { value: mintPrice }
      );
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      
      // 5. Get token ID from events
      const event = receipt.logs.find(
        log => log.eventName === 'NFTMinted'
      );
      
      const tokenId = event.args.tokenId;
      
      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: tx.hash,
        tokenURI: tokenURI
      };
      
    } catch (error) {
      console.error("Mint failed:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Listen for mint events
  listenForMints(callback) {
    this.contract.on("NFTMinted", (to, tokenId, tokenURI) => {
      callback({
        to: to,
        tokenId: tokenId.toString(),
        tokenURI: tokenURI
      });
    });
  }
}

// Usage example
async function mintNFT() {
  const minter = new NFTMinter(CONTRACT_ADDRESS);
  
  // Connect wallet
  const address = await minter.connect();
  console.log("Connected:", address);
  
  // Check mint price
  const price = await minter.getMintPrice();
  console.log("Mint price:", price, "ETH");
  
  // Mint NFT
  const result = await minter.mint(
    "My Awesome NFT #1",
    "This is my first NFT!",
    "https://example.com/image.png"
  );
  
  if (result.success) {
    console.log("✅ NFT minted! Token ID:", result.tokenId);
  } else {
    console.log("❌ Mint failed:", result.error);
  }
}

// Listen for all mints
const minter = new NFTMinter(CONTRACT_ADDRESS);
await minter.connect();
minter.listenForMints((event) => {
  console.log("🎉 New NFT minted:", event);
});`
    },
    {
      id: 'typescript',
      label: 'Frontend (TypeScript)',
      language: 'typescript',
      code: `import { ethers, Contract, BrowserProvider } from 'ethers';

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface MintResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  tokenURI?: string;
  error?: string;
}

const NFT_ABI = [
  "function mint(address to, string memory tokenURI) payable returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI)"
];

class NFTMinter {
  private contract: Contract | null = null;
  private provider: BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  
  constructor(private contractAddress: string) {}
  
  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
    
    this.provider = new BrowserProvider(window.ethereum);
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();
    this.contract = new Contract(
      this.contractAddress,
      NFT_ABI,
      this.signer
    );
    
    return await this.signer.getAddress();
  }
  
  async mint(
    name: string,
    description: string,
    imageUrl: string
  ): Promise<MintResult> {
    if (!this.contract || !this.signer) {
      throw new Error("Not connected");
    }
    
    try {
      const metadata: NFTMetadata = {
        name,
        description,
        image: imageUrl,
        attributes: [
          { trait_type: "Created", value: new Date().toISOString() }
        ]
      };
      
      const tokenURI = await this.uploadToIPFS(metadata);
      const mintPrice = await this.contract.mintPrice();
      
      const tx = await this.contract.mint(
        await this.signer.getAddress(),
        tokenURI,
        { value: mintPrice }
      );
      
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.eventName === 'NFTMinted'
      );
      
      return {
        success: true,
        tokenId: event?.args.tokenId.toString(),
        transactionHash: tx.hash,
        tokenURI
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async uploadToIPFS(metadata: NFTMetadata): Promise<string> {
    // Implement IPFS upload logic
    return \`ipfs://\${Math.random().toString(36).substring(7)}\`;
  }
}

export default NFTMinter;`
    }
  ]);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'step1',
      title: 'Understanding ERC-721',
      description: 'Learn the NFT standard and import OpenZeppelin contracts',
      code: tabs[0].code,
      language: 'solidity',
      explanation: 'ERC-721 is the standard for NFTs. We inherit from OpenZeppelin\'s ERC721 for the base functionality, ERC721URIStorage for metadata storage, and Ownable for access control.',
      checkpoints: [
        {
          label: 'Import ERC721 base contract',
          check: (code) => code.includes('ERC721.sol')
        },
        {
          label: 'Import ERC721URIStorage for metadata',
          check: (code) => code.includes('ERC721URIStorage')
        },
        {
          label: 'Import Ownable for access control',
          check: (code) => code.includes('Ownable')
        }
      ]
    },
    {
      id: 'step2',
      title: 'Token ID Counter',
      description: 'Implement unique token ID generation',
      code: tabs[0].code,
      language: 'solidity',
      explanation: 'Each NFT needs a unique ID. We use OpenZeppelin\'s Counters library to safely increment token IDs. This prevents duplicate IDs and overflow issues.',
      checkpoints: [
        {
          label: 'Import Counters library',
          check: (code) => code.includes('Counters')
        },
        {
          label: 'Create counter variable',
          check: (code) => code.includes('_tokenIds')
        },
        {
          label: 'Increment counter on mint',
          check: (code) => code.includes('.increment()')
        }
      ]
    },
    {
      id: 'step3',
      title: 'Mint Function',
      description: 'Create the core minting logic with payment handling',
      code: tabs[0].code,
      language: 'solidity',
      explanation: 'The mint function creates a new NFT. It checks supply limits, requires payment, increments the counter, mints the token, and sets its metadata URI.',
      checkpoints: [
        {
          label: 'Check max supply limit',
          check: (code) => code.includes('MAX_SUPPLY')
        },
        {
          label: 'Require mint payment',
          check: (code) => code.includes('msg.value') && code.includes('mintPrice')
        },
        {
          label: 'Use _safeMint to create token',
          check: (code) => code.includes('_safeMint')
        },
        {
          label: 'Set token URI for metadata',
          check: (code) => code.includes('_setTokenURI')
        }
      ],
      challenge: {
        task: 'Add a whitelist mapping that allows certain addresses to mint for free',
        solution: 'mapping(address => bool) public whitelist; if (!whitelist[msg.sender]) require(msg.value >= mintPrice);'
      }
    },
    {
      id: 'step4',
      title: 'Frontend Integration',
      description: 'Connect to the contract using ethers.js',
      code: tabs[1].code,
      language: 'javascript',
      explanation: 'We use ethers.js to interact with the contract. First, we create a provider, get the signer (user\'s wallet), then instantiate the contract with its ABI.',
      checkpoints: [
        {
          label: 'Create BrowserProvider from MetaMask',
          check: (code) => code.includes('BrowserProvider')
        },
        {
          label: 'Get signer for transactions',
          check: (code) => code.includes('getSigner')
        },
        {
          label: 'Create contract instance with ABI',
          check: (code) => code.includes('new ethers.Contract')
        }
      ]
    },
    {
      id: 'step5',
      title: 'Metadata & IPFS',
      description: 'Upload NFT metadata to IPFS before minting',
      code: tabs[1].code,
      language: 'javascript',
      explanation: 'NFT metadata (name, description, image) should be stored on IPFS for decentralization. We upload the JSON metadata first, then pass the IPFS URI to the mint function.',
      checkpoints: [
        {
          label: 'Create metadata object',
          check: (code) => code.includes('metadata') && code.includes('name')
        },
        {
          label: 'Upload to IPFS',
          check: (code) => code.includes('IPFS') || code.includes('ipfs://')
        },
        {
          label: 'Pass tokenURI to mint function',
          check: (code) => code.includes('tokenURI')
        }
      ],
      hints: [
        'Use Pinata, NFT.Storage, or Infura for IPFS uploads',
        'Metadata should follow the ERC-721 metadata standard'
      ]
    },
    {
      id: 'step6',
      title: 'Event Listening',
      description: 'Listen for NFTMinted events to track new mints',
      code: tabs[1].code,
      language: 'javascript',
      explanation: 'Smart contracts emit events that we can listen to. This allows real-time updates when NFTs are minted, without constantly polling the blockchain.',
      checkpoints: [
        {
          label: 'Use contract.on() to listen',
          check: (code) => code.includes('.on(')
        },
        {
          label: 'Listen for NFTMinted event',
          check: (code) => code.includes('NFTMinted')
        },
        {
          label: 'Handle event data in callback',
          check: (code) => code.includes('tokenId') && code.includes('callback')
        }
      ]
    }
  ];

  const challenge: Challenge = {
    id: 'nft-challenge',
    title: 'Add Batch Minting',
    description: 'Implement a function that allows minting multiple NFTs in one transaction',
    difficulty: 'medium',
    points: 200,
    initialCode: tabs[0].code,
    solution: tabs[0].code.replace(
      '    function mint(address to, string memory tokenURI)',
      `    function batchMint(address to, string[] memory tokenURIs) public payable returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        require(_tokenIds.current() + tokenURIs.length <= MAX_SUPPLY, "Exceeds max supply");
        require(msg.value >= mintPrice * tokenURIs.length, "Insufficient payment");
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            _tokenIds.increment();
            uint256 newTokenId = _tokenIds.current();
            _safeMint(to, newTokenId);
            _setTokenURI(newTokenId, tokenURIs[i]);
            tokenIds[i] = newTokenId;
            emit NFTMinted(to, newTokenId, tokenURIs[i]);
        }
        
        return tokenIds;
    }
    
    function mint(address to, string memory tokenURI)`
    ),
    tests: [
      {
        id: 'test1',
        description: 'Function accepts an array of token URIs',
        validate: (code) => code.includes('string[]') && code.includes('tokenURIs')
      },
      {
        id: 'test2',
        description: 'Checks total supply doesn\'t exceed MAX_SUPPLY',
        validate: (code) => code.includes('MAX_SUPPLY') && code.includes('length')
      },
      {
        id: 'test3',
        description: 'Requires payment for all mints',
        validate: (code) => code.includes('mintPrice') && code.includes('* ') && code.includes('.length')
      },
      {
        id: 'test4',
        description: 'Uses a loop to mint multiple tokens',
        validate: (code) => code.includes('for') && code.includes('_safeMint')
      }
    ],
    hints: [
      'Create a new function called batchMint that accepts string[] memory',
      'Calculate total cost as mintPrice * tokenURIs.length',
      'Use a for loop to mint each NFT',
      'Return an array of the new token IDs'
    ]
  };

  const handleCodeChange = (tabId: string, code: string) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, code } : tab));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              NFT Minter Tutorial
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Learn how to create and mint ERC-721 NFTs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('tutorial')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'tutorial'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Tutorial
              </button>
              <button
                onClick={() => setViewMode('challenge')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'challenge'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                Challenge
              </button>
            </div>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
              Intermediate
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Center - Code Editor */}
        <div className="flex-1 p-4">
          <MultiLanguageTabs
            tabs={tabs}
            onCodeChange={handleCodeChange}
            height="100%"
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-96 bg-white dark:bg-gray-800 overflow-hidden">
          {viewMode === 'tutorial' ? (
            <InteractiveTutorial
              steps={tutorialSteps}
              currentCode={tabs[0].code}
              onCodeChange={(code) => handleCodeChange('solidity', code)}
              onStepChange={() => {}}
              onComplete={() => alert('🎉 Tutorial completed! Try the challenge next!')}
            />
          ) : (
            <ChallengeSystem
              challenge={challenge}
              currentCode={tabs[0].code}
              onCodeChange={(code) => handleCodeChange('solidity', code)}
              onComplete={(points) => alert(`🏆 Challenge completed! You earned ${points} points!`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
