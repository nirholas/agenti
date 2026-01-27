/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every semicolon has a purpose 😊
 */

import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Layers, Code2 } from 'lucide-react';
import WalletConnectExample from '@/examples/web3/WalletConnectExample';
import WalletConnectFullStack from '@/examples/web3/WalletConnectFullStack';
import SmartContractExample from '@/examples/web3/SmartContractExample';
import NFTMinterExample from '@/examples/web3/NFTMinterExample';
import NFTMinterFullStack from '@/examples/web3/NFTMinterFullStack';
import TokenSwapExample from '@/examples/web3/TokenSwapExample';
import TokenSwapFullStack from '@/examples/web3/TokenSwapFullStack';
import AIContractGenerator from '@/examples/ai/AIContractGenerator';
import AIFullStackBuilder from '@/examples/ai/AIFullStackBuilder';
import AIChatAssistant from '@/examples/ai/AIChatAssistant';
import DeFiLendingExample from '@/examples/web3/DeFiLendingExample';
import YieldFarmingExample from '@/examples/web3/YieldFarmingExample';
import DAOGovernanceExample from '@/examples/web3/DAOGovernanceExample';
import NFTMarketplaceExample from '@/examples/web3/NFTMarketplaceExample';
import MultiSigWalletExample from '@/examples/web3/MultiSigWalletExample';
import ERC20TokenExample from '@/examples/web3/ERC20TokenExample';
import ERC20TokenFullStack from '@/examples/web3/ERC20TokenFullStack';
import TokenVestingExample from '@/examples/web3/TokenVestingExample';
import SolanaTokenExample from '@/examples/web3/SolanaTokenExample';
import CrossChainBridgeExample from '@/examples/web3/CrossChainBridgeExample';
import StakingExample from '@/examples/web3/StakingExample';
import ExampleWithPlayground from '@/components/ExampleWithPlayground';
import UnifiedSandbox from '@/components/Sandbox/UnifiedSandbox';
import { getTemplateById } from '@/utils/contractTemplates';

interface ExampleMeta {
  component: React.ComponentType;
  fullStackComponent?: React.ComponentType; // Full-stack playground version
  title: string;
  description: string;
  templateId?: string;  // Maps to contractTemplates
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  contractName?: string;
  // Inline contract code for examples without templates
  inlineCode?: string;
}

const exampleMeta: Record<string, ExampleMeta> = {
  'wallet-connect': {
    component: WalletConnectExample,
    fullStackComponent: WalletConnectFullStack,
    title: 'Wallet Connection',
    description: 'Connect Web3 wallets like MetaMask to your dApp',
    difficulty: 'beginner',
    tags: ['wallet', 'metamask', 'ethers.js'],
    inlineCode: `// Wallet connection is handled via ethers.js
// No smart contract required for basic wallet connection

import { ethers } from 'ethers';

// Connect to MetaMask
async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return { provider, signer, address: accounts[0] };
  }
  throw new Error('MetaMask not installed');
}

// Get wallet balance
async function getBalance(address: string, provider: ethers.Provider) {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}`,
  },
  'smart-contract': {
    component: SmartContractExample,
    title: 'Smart Contract Basics',
    description: 'Learn the fundamentals of writing and interacting with smart contracts',
    templateId: 'erc20-basic',
    difficulty: 'beginner',
    tags: ['solidity', 'basics'],
    contractName: 'SimpleContract.sol',
  },
  'nft-minter': {
    component: NFTMinterExample,
    fullStackComponent: NFTMinterFullStack,
    title: 'NFT Minter',
    description: 'Create and mint ERC-721 NFTs with metadata',
    templateId: 'erc721-nft',
    difficulty: 'intermediate',
    tags: ['nft', 'erc721', 'ipfs'],
    contractName: 'NFTCollection.sol',
  },
  'token-swap': {
    component: TokenSwapExample,
    fullStackComponent: TokenSwapFullStack,
    title: 'Token Swap DEX',
    description: 'Build a decentralized exchange for token swaps',
    templateId: 'token-swap-dex',
    difficulty: 'advanced',
    tags: ['defi', 'dex', 'amm'],
    contractName: 'TokenSwap.sol',
  },
  'ai-contract-generator': {
    component: AIContractGenerator,
    title: 'AI Contract Generator',
    description: 'Generate smart contracts using AI prompts',
    difficulty: 'beginner',
    tags: ['ai', 'generator'],
    inlineCode: `// AI Contract Generator
// This demo uses AI to generate contract code from natural language

// Example prompt: "Create a token with 1 million supply"
// The AI analyzes your request and generates appropriate Solidity code

// Behind the scenes, the generator:
// 1. Parses your natural language description
// 2. Maps to relevant contract patterns (ERC20, ERC721, etc.)
// 3. Generates optimized, secure Solidity code
// 4. Adds OpenZeppelin imports for battle-tested implementations

// Try prompts like:
// - "Create an NFT collection with 10k max supply"
// - "Build a staking contract with 10% APY"
// - "Make a DAO with token-based voting"`,
  },
  'ai-fullstack-builder': {
    component: AIFullStackBuilder,
    title: 'AI Full-Stack dApp Builder',
    description: 'Generate complete dApps with smart contracts AND frontend UI using AI',
    difficulty: 'beginner',
    tags: ['ai', 'fullstack', 'dapp', 'frontend'],
    inlineCode: `// AI Full-Stack dApp Builder
// Generate complete Web3 applications from natural language

// This powerful tool creates:
// 1. Smart Contract (Solidity)
// 2. HTML Structure
// 3. CSS Styling  
// 4. JavaScript Integration (ethers.js)

// Example prompts:
// - "Build an NFT minting dApp with a gallery"
// - "Create a DAO governance interface"
// - "Make a token dashboard with transfer/burn"

// The generated code is fully editable in the
// interactive playground with live preview!`,
  },
  'ai-chat-assistant': {
    component: AIChatAssistant,
    title: 'AI Chat Assistant',
    description: 'Smart coding assistant using pattern matching - no API key required!',
    difficulty: 'intermediate',
    tags: ['ai', 'chat', 'assistant', 'free'],
    inlineCode: `// Lyra AI Chat Assistant
// A smart coding assistant that works without an API key!

// This example demonstrates how to build an AI assistant using:
// 1. Pattern Matching - Match user queries to knowledge entries
// 2. Knowledge Base - Curated Q&A for Solidity/Web3 topics
// 3. Response Formatting - Rich responses with code examples

// Key benefits:
// - 🆓 Completely free - no API costs
// - ⚡ Instant responses - no network latency
// - 🔒 100% private - data stays in browser
// - 📴 Works offline!

// Perfect for:
// - Documentation bots
// - Code assistants
// - FAQ systems
// - Educational tools

// Try asking about mappings, ERC-20, security, DeFi, and more!`,
  },
  'defi-lending': {
    component: DeFiLendingExample,
    title: 'DeFi Lending Protocol',
    description: 'Create a decentralized lending and borrowing platform',
    templateId: 'defi-lending',
    difficulty: 'advanced',
    tags: ['defi', 'lending', 'collateral'],
    contractName: 'LendingPool.sol',
  },
  'yield-farming': {
    component: YieldFarmingExample,
    title: 'Yield Farming',
    description: 'Build a yield farming protocol with liquidity rewards',
    templateId: 'yield-farming',
    difficulty: 'advanced',
    tags: ['defi', 'farming', 'rewards'],
    contractName: 'YieldFarm.sol',
  },
  'dao-governance': {
    component: DAOGovernanceExample,
    title: 'DAO Governance',
    description: 'Decentralized governance with proposals and voting',
    templateId: 'dao-governance',
    difficulty: 'advanced',
    tags: ['dao', 'voting', 'governance'],
    contractName: 'DAO.sol',
  },
  'nft-marketplace': {
    component: NFTMarketplaceExample,
    title: 'NFT Marketplace',
    description: 'Buy, sell, and auction NFTs on a decentralized marketplace',
    templateId: 'nft-marketplace',
    difficulty: 'advanced',
    tags: ['nft', 'marketplace', 'auction'],
    contractName: 'NFTMarketplace.sol',
  },
  'multisig-wallet': {
    component: MultiSigWalletExample,
    title: 'Multi-Signature Wallet',
    description: 'Secure wallet requiring multiple approvals for transactions',
    templateId: 'multisig-wallet',
    difficulty: 'advanced',
    tags: ['security', 'multisig', 'wallet'],
    contractName: 'MultiSigWallet.sol',
  },
  'erc20-token': {
    component: ERC20TokenExample,
    fullStackComponent: ERC20TokenFullStack,
    title: 'ERC-20 Token',
    description: 'Create a fungible token with the ERC-20 standard',
    templateId: 'erc20-basic',
    difficulty: 'beginner',
    tags: ['token', 'erc20', 'fungible'],
    contractName: 'MyToken.sol',
  },
  'token-vesting': {
    component: TokenVestingExample,
    title: 'Token Vesting',
    description: 'Time-locked token release for team and investors',
    templateId: 'token-vesting',
    difficulty: 'intermediate',
    tags: ['vesting', 'timelock', 'tokens'],
    contractName: 'TokenVesting.sol',
  },
  'solana-token': {
    component: SolanaTokenExample,
    title: 'Solana Token',
    description: 'Create SPL tokens on the Solana blockchain',
    difficulty: 'intermediate',
    tags: ['solana', 'spl', 'rust'],
    inlineCode: `// Solana SPL Token Program
// Solana uses Rust instead of Solidity

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("YourProgramId");

#[program]
pub mod spl_token_example {
    use super::*;

    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        decimals: u8,
    ) -> Result<()> {
        msg!("Token mint initialized with {} decimals", decimals);
        Ok(())
    }

    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64,
    ) -> Result<()> {
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(init, payer = payer, mint::decimals = 9, mint::authority = payer)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}`,
  },
  'cross-chain-bridge': {
    component: CrossChainBridgeExample,
    title: 'Cross-Chain Bridge',
    description: 'Transfer assets between different blockchain networks',
    difficulty: 'advanced',
    tags: ['bridge', 'cross-chain', 'multichain'],
    inlineCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Cross-Chain Bridge
 * @notice Lock tokens on source chain, mint on destination chain
 */
contract CrossChainBridge is ReentrancyGuard, Ownable {
    mapping(bytes32 => bool) public processedNonces;
    mapping(address => bool) public supportedTokens;
    
    uint256 public nonce;
    uint256 public bridgeFee = 0.001 ether;
    
    event TokensLocked(
        address indexed token,
        address indexed sender,
        uint256 amount,
        uint256 targetChainId,
        uint256 nonce
    );
    
    event TokensReleased(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 sourceNonce
    );
    
    function lockTokens(
        address token,
        uint256 amount,
        uint256 targetChainId
    ) external payable nonReentrant {
        require(msg.value >= bridgeFee, "Insufficient bridge fee");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        emit TokensLocked(token, msg.sender, amount, targetChainId, nonce++);
    }
    
    // Relayer calls this on destination chain
    function releaseTokens(
        address token,
        address recipient,
        uint256 amount,
        bytes32 sourceNonce
    ) external onlyOwner nonReentrant {
        require(!processedNonces[sourceNonce], "Already processed");
        processedNonces[sourceNonce] = true;
        
        IERC20(token).transfer(recipient, amount);
        
        emit TokensReleased(token, recipient, amount, sourceNonce);
    }
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
}`,
  },
  'staking': {
    component: StakingExample,
    title: 'Token Staking',
    description: 'Stake tokens and earn rewards over time',
    templateId: 'token-staking',
    difficulty: 'intermediate',
    tags: ['staking', 'rewards', 'defi'],
    contractName: 'StakingRewards.sol',
  },
};

// Legacy mapping for backward compatibility
const exampleComponents: Record<string, React.ComponentType> = Object.fromEntries(
  Object.entries(exampleMeta).map(([key, meta]) => [key, meta.component])
);

export default function ExamplePage() {
  const { exampleId } = useParams<{ exampleId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewMode: 'sandbox' | 'tutorial' = viewParam === 'sandbox' ? 'sandbox' : 'tutorial'; // Default to tutorial view
  
  if (!exampleId) {
    return (
      <div className="container py-12">
        <p className="text-center text-gray-600 dark:text-gray-400">
          Example not found
        </p>
      </div>
    );
  }

  const meta = exampleMeta[exampleId];
  const ExampleComponent = meta?.component;
  const FullStackComponent = meta?.fullStackComponent;

  if (!ExampleComponent || !meta) {
    return (
      <div className="container py-12">
        <Link to="/" className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Examples</span>
        </Link>
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Example Coming Soon</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            This example is currently under development. Check back soon!
          </p>
          <Link to="/" className="btn-primary">
            Browse Other Examples
          </Link>
        </div>
      </div>
    );
  }

  // Get contract code from template or inline
  const contractCode = meta.templateId 
    ? (getTemplateById(meta.templateId)?.code || meta.inlineCode || '// No code available')
    : (meta.inlineCode || '// No code available');

  // Check if this example has a template that can be used in sandbox mode
  const hasSandboxSupport = !!(meta.templateId || meta.inlineCode);

  // If viewing in sandbox mode and we have sandbox support, show the UnifiedSandbox
  if (viewMode === 'sandbox' && hasSandboxSupport) {
    return (
      <div className="h-screen flex flex-col">
        {/* Mini header with back button and view toggle */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/examples" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Examples</span>
            </Link>
            <div className="w-px h-5 bg-gray-700" />
            <span className="text-white font-medium">{meta.title}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchParams({ view: 'sandbox' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewParam !== 'tutorial' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sandbox
            </button>
            <button
              onClick={() => setSearchParams({ view: 'tutorial' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewParam === 'tutorial' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Code2 className="w-4 h-4" />
              Tutorial
            </button>
          </div>
        </div>
        
        {/* UnifiedSandbox takes the rest of the screen */}
        <div className="flex-1">
          <UnifiedSandbox
            templateId={meta.templateId}
            initialContract={contractCode}
            title={meta.title}
            description={meta.description}
          />
        </div>
      </div>
    );
  }

  // If there's a full-stack component, render it directly (it's self-contained)
  if (FullStackComponent) {
    return <FullStackComponent />;
  }

  return (
    <div className="container py-8">
      <Link to="/" className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 mb-8">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Examples</span>
      </Link>
      
      <ExampleWithPlayground
        title={meta.title}
        description={meta.description}
        contractCode={contractCode}
        contractName={meta.contractName || 'Contract.sol'}
        difficulty={meta.difficulty}
        tags={meta.tags}
      >
        <ExampleComponent />
      </ExampleWithPlayground>
    </div>
  );
}
