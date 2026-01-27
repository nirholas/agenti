/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Homepage
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground | 🌐 https://lyra.works
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Attribution marker - nich | x.com/nichxbt | github.com/nirholas
const __attr__ = { _n: 'nich', _x: 'nichxbt', _g: 'nirholas' };

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import Editor from '@monaco-editor/react';
import { useThemeStore } from '@/stores/themeStore';
import PriceTicker from '@/components/PriceTicker';
import { TopProtocolsWidget, TopYieldsWidget, TopChainsWidget, DeFiSummaryBar } from '@/components/DeFiWidgets';
import { useWalletStore } from '@/stores/walletStore';
import { FullStackPlayground, PlaygroundFile } from '@/components/FullStackPlayground';
import LivePreview from '@/components/Playground/LivePreview';
import TemplateSelector from '@/components/Playground/TemplateSelector';
import { ContractTemplate, contractTemplates } from '@/utils/contractTemplates';
import { LyraChatPanel } from '@/components/Lyra/LyraChat';
import { generateLyraResponse, getWelcomeMessage } from '@/services/lyraAI';
import { 
  Wallet, 
  Code, 
  Image, 
  Vote, 
  Layers,
  Bot,
  Brain,
  Sparkles,
  Search,
  ChevronRight,
  Zap,
  Shield,
  Globe,
  ArrowDownUp,
  Coins,
  Lock,
  DollarSign,
  Sprout,
  ShoppingCart,
  BookOpen,
  Monitor,
  FileCode,
  Terminal,
  Cpu,
  Users,
  History,
  Target,
  Eye,
  Palette,
  Languages,
  MousePointer,
  TrendingUp,
  BarChart3,
  GitBranch,
  TestTube,
  Play,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  GraduationCap,
  Map,
  HelpCircle,
  Heart,
  FileText,
  Calendar
} from 'lucide-react';
import { Example } from '@/types';
import { cn } from '@/utils/helpers';
import useI18n from '@/stores/i18nStore';

const examples: Example[] = [
  // Basic Web3 Examples
  {
    id: 'wallet-connect',
    title: 'Wallet Connection',
    description: 'Connect MetaMask, view balance, and interact with Ethereum networks',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'beginner',
    tags: ['ethereum', 'wallet', 'metamask'],
    component: () => null,
    icon: Wallet,
  },
  {
    id: 'token-swap',
    title: 'Token Swapper',
    description: 'Swap tokens using decentralized exchanges with live price quotes',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'beginner',
    tags: ['defi', 'swap', 'dex'],
    component: () => null,
    icon: ArrowDownUp,
  },
  
  // DeFi Examples
  {
    id: 'defi-lending',
    title: 'DeFi Lending Protocol',
    description: 'Deposit assets to earn interest and borrow against collateral like Aave',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['defi', 'lending', 'borrowing', 'aave'],
    component: () => null,
    icon: DollarSign,
  },
  {
    id: 'yield-farming',
    title: 'Yield Farming',
    description: 'Stake LP tokens to earn rewards from liquidity provision',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['defi', 'farming', 'liquidity', 'rewards'],
    component: () => null,
    icon: Sprout,
  },
  {
    id: 'staking',
    title: 'Token Staking',
    description: 'Stake tokens to earn passive rewards with flexible or locked periods',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'beginner',
    tags: ['staking', 'rewards', 'passive-income'],
    component: () => null,
    icon: Lock,
  },
  
  // NFT Examples
  {
    id: 'nft-minter',
    title: 'NFT Minter',
    description: 'Create and mint NFTs with IPFS storage and metadata',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['nft', 'ipfs', 'erc721'],
    component: () => null,
    icon: Image,
  },
  {
    id: 'nft-marketplace',
    title: 'NFT Marketplace',
    description: 'Buy, sell, and trade unique digital collectibles like OpenSea',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['nft', 'marketplace', 'trading'],
    component: () => null,
    icon: ShoppingCart,
  },
  
  // DAO Examples
  {
    id: 'dao-governance',
    title: 'DAO Governance',
    description: 'Create proposals and vote on DAO decisions with token-based voting',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['dao', 'governance', 'voting'],
    component: () => null,
    icon: Vote,
  },
  
  // Token Examples
  {
    id: 'erc20-token',
    title: 'ERC-20 Token',
    description: 'Standard fungible token implementation with transfer and approval',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'beginner',
    tags: ['token', 'erc20', 'fungible'],
    component: () => null,
    icon: Coins,
  },
  {
    id: 'token-vesting',
    title: 'Token Vesting',
    description: 'Time-locked token distribution for team members and investors',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['token', 'vesting', 'timelock'],
    component: () => null,
    icon: Lock,
  },
  
  // Security Examples
  {
    id: 'multisig-wallet',
    title: 'Multi-Signature Wallet',
    description: 'Secure wallet requiring multiple approvals for transactions',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'advanced',
    tags: ['security', 'multisig', 'wallet'],
    component: () => null,
    icon: Shield,
  },
  
  // Cross-Chain Examples
  {
    id: 'cross-chain-bridge',
    title: 'Cross-Chain Bridge',
    description: 'Transfer tokens between Ethereum, Polygon, Arbitrum, and Optimism',
    category: 'web3',
    chain: 'multi',
    difficulty: 'advanced',
    tags: ['bridge', 'cross-chain', 'layer2'],
    component: () => null,
    icon: Layers,
  },
  
  // Solana Examples
  {
    id: 'solana-token',
    title: 'Solana SPL Token',
    description: 'Work with SOL and SPL tokens on the Solana blockchain',
    category: 'web3',
    chain: 'solana',
    difficulty: 'intermediate',
    tags: ['solana', 'spl', 'token'],
    component: () => null,
    icon: Coins,
  },
  
  // Smart Contract Examples
  {
    id: 'smart-contract',
    title: 'Smart Contract Deployer',
    description: 'Write, compile, and deploy Solidity smart contracts to testnets',
    category: 'web3',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['solidity', 'smart-contracts', 'deployment'],
    component: () => null,
    icon: Code,
  },
  
  // AI Examples
  {
    id: 'ai-contract-generator',
    title: 'AI Contract Generator',
    description: 'Generate smart contracts using AI based on natural language',
    category: 'hybrid',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['ai', 'smart-contracts', 'automation'],
    component: () => null,
    icon: Bot,
  },
  {
    id: 'ai-fullstack-builder',
    title: 'AI Full-Stack dApp Builder',
    description: 'Generate complete dApps with smart contracts AND frontend using AI',
    category: 'hybrid',
    chain: 'ethereum',
    difficulty: 'beginner',
    tags: ['ai', 'fullstack', 'dapp', 'frontend'],
    component: () => null,
    icon: Sparkles,
  },
  {
    id: 'ai-chat-assistant',
    title: 'AI Chat Assistant',
    description: 'Smart coding assistant using pattern matching - no API key needed!',
    category: 'ai',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['ai', 'chat', 'assistant', 'free'],
    component: () => null,
    icon: MessageCircle,
  },
  {
    id: 'blockchain-analyzer',
    title: 'Blockchain Data Analyzer',
    description: 'Analyze on-chain data with AI-powered insights',
    category: 'hybrid',
    chain: 'multi',
    difficulty: 'advanced',
    tags: ['ai', 'analytics', 'blockchain'],
    component: () => null,
    icon: Brain,
  },
  {
    id: 'nft-art-generator',
    title: 'AI NFT Art Generator',
    description: 'Generate and mint AI-created artwork as NFTs',
    category: 'hybrid',
    chain: 'ethereum',
    difficulty: 'intermediate',
    tags: ['ai', 'nft', 'generative-art'],
    component: () => null,
    icon: Sparkles,
  },
];

// Simple inline wallet connect component (no modal overlay)
function WalletConnectInline() {
  const { address, isConnected, balance, disconnect, setWallet } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectMetaMask = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install it from metamask.io');
      }

      const { BrowserProvider } = await import('ethers');
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const userBalance = await provider.getBalance(userAddress);

      setWallet({
        address: userAddress,
        chainId: Number(network.chainId),
        balance: (Number(userBalance) / 1e18).toFixed(4),
        isConnected: true,
        provider: window.ethereum,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const truncateAddress = (addr: string) => 
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isConnected && address) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-black rounded-xl border border-gray-300 dark:border-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.03)]">
          <div className="w-10 h-10 bg-gray-700 dark:bg-gray-300 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-white dark:text-black" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Connected!</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{truncateAddress(address)}</p>
          </div>
        </div>
        {balance && (
          <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
            <span className="font-semibold">{balance} ETH</span>
          </div>
        )}
        <button
          onClick={disconnect}
          className="w-full py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Connect your wallet to interact with Web3 examples (optional).
      </p>
      {error && (
        <div className="p-3 bg-gray-100 dark:bg-black border border-gray-400 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-gray-200">
          {error}
        </div>
      )}
      <button
        onClick={connectMetaMask}
        disabled={isConnecting}
        className="w-full btn-primary flex items-center justify-center gap-2 py-3"
      >
        <Wallet className="w-5 h-5" />
        {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Don't have MetaMask?{' '}
        <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-gray-700 dark:text-gray-300 underline hover:text-gray-900 dark:hover:text-white">
          Download it here
        </a>
      </p>
    </div>
  );
}

export default function Homepage() {
  const { t } = useI18n();
  const { mode } = useThemeStore();
  
  useSEO({
    title: 'Learn Blockchain Development',
    description: 'Free interactive Web3 learning platform. Build smart contracts, DeFi apps, and NFTs with 50+ tutorials, 40+ templates, and a browser-based IDE.',
    path: '/'
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'web3' | 'ai' | 'hybrid'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  
  // State for interactive demo sections
  const [demoCode, setDemoCode] = useState(`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message = "Hello, Blockchain!";
    
    function setMessage(string memory _message) public {
        message = _message;
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
}`);
  const [showWalletDemo, setShowWalletDemo] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Live HTML/CSS/JS demo
  const [htmlDemo] = useState(`<div class="wallet-demo">
  <h2>🦊 Web3 Connection</h2>
  <button id="connectBtn" class="connect-btn">
    Connect Wallet
  </button>
  <div id="status">Click to simulate</div>
</div>`);
  const [cssDemo] = useState(`.wallet-demo {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  color: white;
}
.connect-btn {
  background: white;
  color: #667eea;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  margin: 1rem 0;
}
.connect-btn:hover {
  transform: scale(1.05);
}
#status {
  font-size: 0.9rem;
  opacity: 0.9;
}`);
  const [jsDemo] = useState(`document.getElementById('connectBtn').onclick = function() {
  const status = document.getElementById('status');
  this.textContent = 'Connecting...';
  
  setTimeout(() => {
    const addr = '0x' + Math.random().toString(16).slice(2, 10) + '...';
    status.textContent = '✅ Connected: ' + addr;
    this.textContent = 'Connected!';
    this.style.background = '#10b981';
    this.style.color = 'white';
  }, 1000);
};`);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(demoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [demoCode]);

  // Lyra AI Chat demo state
  const [lyraChatMessages, setLyraChatMessages] = useState<Array<{id: string; content: string; role: 'user' | 'assistant'}>>([
    getWelcomeMessage()
  ]);
  const [lyraLoading, setLyraLoading] = useState(false);

  const handleLyraSend = useCallback(async (message: string) => {
    const userMsg = { id: Date.now().toString(), content: message, role: 'user' as const };
    setLyraChatMessages(prev => [...prev, userMsg]);
    setLyraLoading(true);
    
    try {
      // Use real Lyra AI service
      const response = await generateLyraResponse(message);
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        role: 'assistant' as const
      };
      setLyraChatMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Lyra AI error:', error);
      const errorResponse = {
        id: (Date.now() + 1).toString(),
        content: "I encountered an issue processing your request. Please try asking about smart contracts, Solidity, or Web3 development!",
        role: 'assistant' as const
      };
      setLyraChatMessages(prev => [...prev, errorResponse]);
    } finally {
      setLyraLoading(false);
    }
  }, []);

  const filteredExamples = examples.filter((example) => {
    const matchesSearch = 
      example.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      example.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      example.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || example.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || example.difficulty === selectedDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const categoryColors = {
    web3: 'bg-gray-200 text-gray-800 dark:bg-white/5 dark:text-gray-200 dark:border dark:border-white/10',
    ai: 'bg-gray-300 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
    hybrid: 'bg-gray-200 text-gray-800 dark:bg-white/5 dark:text-gray-200 dark:border dark:border-white/10',
  };

  const difficultyColors = {
    beginner: 'text-gray-600 dark:text-gray-400',
    intermediate: 'text-gray-700 dark:text-gray-300',
    advanced: 'text-gray-900 dark:text-gray-100',
  };

  return (
    <div className="min-h-screen py-12">
      <div className="container">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center p-3 bg-gray-800 dark:bg-gray-200 rounded-2xl mb-6 shadow-lg">
            <Zap className="w-12 h-12 text-white dark:text-black" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('hero.title')} {t('hero.subtitle')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            {t('hero.description')}
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-black dark:border dark:border-white/10 rounded-lg shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.02)]">
              <Code className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="font-semibold">40+ Templates</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-black dark:border dark:border-white/10 rounded-lg shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.02)]">
              <BookOpen className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="font-semibold">50+ Tutorials</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-black dark:border dark:border-white/10 rounded-lg shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.02)]">
              <Shield className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="font-semibold">Open Source</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LYRA AI CHAT - Interactive AI assistant demo
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
              <MessageCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              Meet Lyra AI
            </h2>
            <p className="text-gray-600 dark:text-gray-400">Your AI coding assistant - try asking about smart contracts!</p>
          </div>
          <div className="max-w-2xl mx-auto h-96">
            <LyraChatPanel
              messages={lyraChatMessages}
              onSend={handleLyraSend}
              loading={lyraLoading}
              title="Lyra AI Assistant"
              placeholder="Ask about Solidity, smart contracts, DeFi..."
            />
          </div>
          
          {/* Learn How to Build This */}
          <div className="mt-6 bg-gray-100 dark:bg-black rounded-xl p-6 border border-gray-200 dark:border-white/10 max-w-2xl mx-auto dark:shadow-[0_0_20px_rgba(255,255,255,0.03)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 justify-center md:justify-start">
                  <Code className="w-5 h-5" />
                  Learn How to Build This
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl">
                  Build your own AI-powered coding assistant using pattern matching and a knowledge base. 
                  No API key required - works entirely in the browser!
                </p>
              </div>
              <Link
                to="/tutorial/react-web3-hooks"
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-5 h-5" />
                Start Tutorial
              </Link>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LIVE PRICE TICKER - Real-time crypto prices
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12 p-4 bg-gray-900 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              Live Market Data
            </h3>
            <Link to="/markets" className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
              View Full Dashboard <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <PriceTicker coins={['bitcoin', 'ethereum', 'solana', 'bnb']} showChange={true} />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DEFI DASHBOARD - Live protocol data
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Live DeFi Analytics</h2>
            <p className="text-gray-600 dark:text-gray-400">Real-time data from DeFiLlama API</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 shadow-lg">
              <TopProtocolsWidget limit={5} />
            </div>
            <div className="bg-gray-900 rounded-xl p-4 shadow-lg">
              <TopYieldsWidget limit={5} />
            </div>
            <div className="bg-gray-900 rounded-xl p-4 shadow-lg">
              <TopChainsWidget limit={5} />
            </div>
          </div>
          
          {/* Learn How to Build This */}
          <div className="bg-gray-100 dark:bg-black rounded-xl p-6 border border-gray-200 dark:border-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.03)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 justify-center md:justify-start">
                  <Code className="w-5 h-5" />
                  Learn How to Build This
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xl">
                  Build your own DeFi analytics dashboard using the DeFiLlama API. Learn how to fetch live protocol data, 
                  display TVL rankings, yield opportunities, and chain statistics in React.
                </p>
              </div>
              <Link
                to="/tutorial/defi-dashboard-tutorial"
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-5 h-5" />
                Start Tutorial
              </Link>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LIVE SOLIDITY EDITOR - Working Monaco editor
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Try Our Code Editor</h2>
            <p className="text-gray-600 dark:text-gray-400">Edit Solidity code right here - this is the same Monaco editor used in VS Code</p>
          </div>
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500" />
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                </div>
                <span className="text-sm text-gray-400 ml-2">HelloWorld.sol</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-gray-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <Link
                  to="/ide"
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm text-white transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Open in IDE
                </Link>
              </div>
            </div>
            {/* Monaco Editor */}
            <div className="h-80">
              <Editor
                height="100%"
                language="sol"
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                value={demoCode}
                onChange={(value) => setDemoCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LIVE WEB PREVIEW - HTML/CSS/JS with live output
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Live Web3 Preview</h2>
            <p className="text-gray-600 dark:text-gray-400">Interactive HTML/CSS/JS demo - click the button to see it work!</p>
          </div>
          <div className="bg-white dark:bg-black rounded-xl overflow-hidden shadow-lg dark:shadow-[0_0_30px_rgba(255,255,255,0.04)] border border-gray-200 dark:border-white/10">
            <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
              <span className="text-sm font-medium">Live Preview</span>
              <Link to="/ide?type=web" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                Open Web IDE <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="h-64">
              <LivePreview html={htmlDemo} css={cssDemo} javascript={jsDemo} title="Web3 Demo" />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            WALLET CONNECT DEMO - Real wallet connection
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600 dark:text-gray-400">Real MetaMask integration - try connecting your wallet (optional)</p>
          </div>
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-black rounded-xl p-6 shadow-lg dark:shadow-[0_0_30px_rgba(255,255,255,0.04)] border border-gray-200 dark:border-white/10">
              <WalletConnectInline />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            FULL-STACK PLAYGROUND DEMO - React + Solidity live editor
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Full-Stack Playground</h2>
            <p className="text-gray-600 dark:text-gray-400">Edit React components with live preview - this is a fully working editor</p>
          </div>
          <FullStackPlayground
            title="Interactive Token Display"
            description="A live React component you can edit - try changing the colors or text!"
            files={[
              {
                id: 'component',
                name: 'TokenCard',
                language: 'typescript',
                icon: 'react',
                code: `function TokenCard() {
  const [balance, setBalance] = useState(1000);
  const [staked, setStaked] = useState(false);
  
  const handleStake = () => {
    setStaked(!staked);
    setBalance(staked ? balance + 100 : balance - 100);
  };

  return (
    <div className="p-6 max-w-sm mx-auto bg-gray-900 rounded-2xl text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
          🪙
        </div>
        <div>
          <h3 className="font-bold text-xl">My Token</h3>
          <p className="text-white/70 text-sm">MTK</p>
        </div>
      </div>
      
      <div className="bg-white/10 rounded-xl p-4 mb-4">
        <p className="text-white/70 text-sm">Balance</p>
        <p className="text-3xl font-bold">{balance.toLocaleString()}</p>
      </div>
      
      <button
        onClick={handleStake}
        className={staked 
          ? "w-full py-3 rounded-xl font-semibold transition-all bg-green-600 text-white hover:bg-green-700" 
          : "w-full py-3 rounded-xl font-semibold transition-all bg-white text-gray-900 hover:bg-gray-100"
        }
      >
        {staked ? '✓ Staked' : 'Stake Tokens'}
      </button>
    </div>
  );
}

render(<TokenCard />);`
              }
            ]}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TEMPLATE BROWSER - Browse all 41 templates
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">41 Contract Templates</h2>
            <p className="text-gray-600 dark:text-gray-400">Browse our library of production-ready smart contracts</p>
          </div>
          <div className="bg-white dark:bg-black rounded-xl shadow-lg dark:shadow-[0_0_30px_rgba(255,255,255,0.04)] border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="max-h-96 overflow-y-auto p-4">
              <TemplateSelector
                onTemplateSelect={(template: ContractTemplate) => {
                  setDemoCode(template.code);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                compact={true}
              />
            </div>
          </div>
        </div>

        {/* Interactive Sandbox CTA Banner */}
        <Link 
          to="/sandbox"
          className="block mb-12 group"
        >
          <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-[1.02]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="w-8 h-8" />
                  <h2 className="text-3xl font-bold">Interactive Sandbox</h2>
                </div>
                <p className="text-white/90 text-lg mb-4">
                  Full-featured browser IDE with multi-file editing, live compilation, and
                  testnet deployment support. AI-assisted features are listed as coming soon.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Multi-File Editor</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Live Deployment</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">AI Features (Coming Soon)</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Contract Testing</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-8 py-4 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                <span className="text-white font-semibold text-lg">Launch Sandbox</span>
                <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        {/* Template Playground Link */}
        <Link 
          to="/playground"
          className="block mb-8 group"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-600 p-8 shadow-2xl hover:shadow-3xl transition-all duration-300 animate-gradient">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl group-hover:scale-110 transition-transform">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="text-left">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                    AI Contract Playground
                  </h2>
                  <p className="text-white/90 text-sm md:text-base">
                    Generate, edit, and deploy smart contracts with AI assistance
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold group-hover:bg-gray-100 transition-colors">
                <span>Try Now</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 group-hover:translate-x-full transition-transform duration-1000" />
          </div>
        </Link>

        {/* Development Environments Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">Universal Development Environments</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Professional-grade UDEs for web and blockchain development
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Web Sandbox */}
            <Link to="/ide?type=web" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Globe className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Production
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Web Sandbox
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Full-featured web UDE with HTML, CSS, JavaScript, React, Vue, and Python support. Live preview with device presets.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Monaco Editor</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Vim Mode</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Live Preview</span>
              </div>
            </Link>

            {/* Solidity UDE */}
            <Link to="/ide?type=solidity" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <FileCode className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Production
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Solidity UDE
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Smart contract development with multi-version compiler (0.6.x - 0.8.24), testnet deployment, and contract interaction.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Multi-Version</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Deploy</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Interact</span>
              </div>
            </Link>

            {/* Full-Stack Playground */}
            <Link to="/fullstack-demo" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Production
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Full-Stack Playground
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Build complete dApps with smart contract and frontend side-by-side. Live preview and console output.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Contract + UI</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Live Preview</span>
              </div>
            </Link>

            {/* Learning Playground */}
            <Link to="/learn" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Production
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Learning Playground
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Guided tutorials with step-by-step instructions, interactive examples, and progress tracking.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Tutorials</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Progress</span>
              </div>
            </Link>

            {/* Markets */}
            <Link to="/markets" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Live Data
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Market Data
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Live crypto prices, DeFi analytics, protocol TVL, and chain statistics from CoinGecko and DeFiLlama.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Prices</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">DeFi TVL</span>
              </div>
            </Link>

            {/* Community Explore */}
            <Link to="/explore" className="group card hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Community
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Explore Projects
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Discover community projects, templates, and tutorials. Like, comment, and fork other developers' work.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Share</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Fork</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Innovation Lab Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium mb-4">
              <TestTube className="w-4 h-4" />
              <span>Experimental Features</span>
            </div>
            <h2 className="text-3xl font-bold mb-3">Innovation Lab</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Advanced AI-powered tools and experimental features. Enable Innovation Mode in the sandbox to try them.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* AI Code Whisperer */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                AI Code Whisperer
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Real-time vulnerability detection, code suggestions, and voice control for hands-free development.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Vulnerabilities</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Voice</span>
              </div>
            </Link>

            {/* Contract Time Machine */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <History className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Contract Time Machine
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Version history with automatic snapshots, branching, and state simulation for exploring alternatives.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">History</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Branching</span>
              </div>
            </Link>

            {/* Security Testing Lab */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Security Testing Lab
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Test contracts against reentrancy, flash loans, overflow, and other attack vectors in a safe environment.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">6 Attacks</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Defense</span>
              </div>
            </Link>

            {/* Collaborative Arena */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Collaborative Arena
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Code with AI teammates, participate in timed challenges, and learn from AI mentors in real-time.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Challenges</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">AI Teams</span>
              </div>
            </Link>

            {/* Neural Gas Oracle */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <Cpu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Neural Gas Oracle
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Machine learning-powered gas prediction and optimization with multiple neural network models.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">ML Models</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Optimize</span>
              </div>
            </Link>

            {/* Cross-Chain Deployer */}
            <Link to="/innovation" className="group card border-dashed hover:border-gray-500 dark:hover:border-gray-400 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl group-hover:scale-110 transition-transform">
                  <GitBranch className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Experimental
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                Cross-Chain Deployer
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Deploy contracts to 8+ blockchains with automated bridge setup and cost optimization.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">8+ Chains</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Auto-Bridge</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Accessibility Features Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3">Accessibility Features</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              WCAG 2.1 AAA compliant with advanced features for all users
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl inline-block mb-3">
                <MousePointer className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </div>
              <h3 className="font-semibold mb-1">Dwell Click</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Click by hovering</p>
            </div>
            
            <div className="card text-center">
              <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl inline-block mb-3">
                <Eye className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </div>
              <h3 className="font-semibold mb-1">Reading Guide</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Line follows cursor</p>
            </div>
            
            <div className="card text-center">
              <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl inline-block mb-3">
                <Palette className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </div>
              <h3 className="font-semibold mb-1">Color Blind Filters</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multiple modes</p>
            </div>
            
            <div className="card text-center">
              <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl inline-block mb-3">
                <Languages className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </div>
              <h3 className="font-semibold mb-1">10 Languages</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Including RTL</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TUTORIAL BROWSER - 50+ Interactive Tutorials
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3 flex items-center justify-center gap-2">
              <GraduationCap className="w-8 h-8 text-primary-600" />
              50+ Interactive Tutorials
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Learn Web3 development step-by-step with hands-on coding exercises
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Beginner Track */}
            <div className="card border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl">
                  <Sprout className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold">Beginner</h3>
                  <p className="text-sm text-gray-500">20+ tutorials</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Solidity Basics</li>
                <li>• Your First Smart Contract</li>
                <li>• Variables & Data Types</li>
                <li>• Functions & Modifiers</li>
              </ul>
            </div>

            {/* Intermediate Track */}
            <div className="card border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl">
                  <Zap className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold">Intermediate</h3>
                  <p className="text-sm text-gray-500">20+ tutorials</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• ERC-20 Token Standard</li>
                <li>• NFT Minting (ERC-721)</li>
                <li>• DeFi Fundamentals</li>
                <li>• Testing & Debugging</li>
              </ul>
            </div>

            {/* Advanced Track */}
            <div className="card border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-xl">
                  <Brain className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold">Advanced</h3>
                  <p className="text-sm text-gray-500">15+ tutorials</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Gas Optimization</li>
                <li>• Security & Auditing</li>
                <li>• Upgradeable Contracts</li>
                <li>• Cross-Chain Development</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/tutorials"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
            >
              <BookOpen className="w-5 h-5" />
              Browse All Tutorials
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search examples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-black focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow text-base"
            />
          </div>

          {/* Mobile-friendly horizontal scrollable filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Category Filter */}
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2 shrink-0">Category:</span>
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 scrollbar-hide">
                {(['all', 'web3', 'ai', 'hybrid'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[40px]',
                      selectedCategory === cat
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500'
                    )}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2 shrink-0">Level:</span>
              <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 scrollbar-hide">
                {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[40px]',
                      selectedDifficulty === diff
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500'
                    )}
                  >
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Examples Grid */}
        {filteredExamples.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400">
              No examples found. Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExamples.map((example, index) => {
              const Icon = example.icon || Code;
              return (
                <Link
                  key={example.id}
                  to={`/example/${example.id}`}
                  className="group card hover:border-primary-500 dark:hover:border-primary-400 transition-all duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      'p-3 rounded-xl transition-transform group-hover:scale-110',
                      categoryColors[example.category]
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      'text-xs font-medium px-2 py-1 rounded-full',
                      difficultyColors[example.difficulty]
                    )}>
                      {example.difficulty}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {example.title}
                  </h3>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {example.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {example.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 text-center p-8 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl border border-primary-200 dark:border-primary-800">
          <h2 className="text-2xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Start exploring our interactive examples, connect your wallet, and dive into the world of Web3 and AI.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <a
              href="https://github.com/nirholas/lyra-web3-playground"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              View on GitHub
            </a>
            <Link
              to="/docs"
              className="btn-secondary"
            >
              Read Documentation
            </Link>
          </div>

          {/* Quick Links */}
          <div className="border-t border-primary-200 dark:border-primary-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">QUICK LINKS</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/tutorials" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <GraduationCap className="w-4 h-4" />
                <span>Tutorials</span>
              </Link>
              <Link to="/roadmap" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <Map className="w-4 h-4" />
                <span>Roadmap</span>
              </Link>
              <Link to="/faq" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <HelpCircle className="w-4 h-4" />
                <span>FAQ</span>
              </Link>
              <Link to="/community" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <Users className="w-4 h-4" />
                <span>Community</span>
              </Link>
              <Link to="/api" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <FileText className="w-4 h-4" />
                <span>API Reference</span>
              </Link>
              <Link to="/changelog" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <Calendar className="w-4 h-4" />
                <span>Changelog</span>
              </Link>
              <Link to="/about" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <Heart className="w-4 h-4" />
                <span>About</span>
              </Link>
              <Link to="/contribute" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                <GitBranch className="w-4 h-4" />
                <span>Contribute</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
