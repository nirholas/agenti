/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Small steps lead to big achievements 🏔️
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import { 
  Search, 
  Wallet, 
  FileCode, 
  Coins, 
  Image, 
  ArrowRightLeft,
  Brain,
  Sparkles,
  Filter,
  Grid3X3,
  List,
  ExternalLink,
  Play,
  Code2
} from 'lucide-react';

interface Example {
  id: string;
  title: string;
  description: string;
  category: 'web3' | 'ai' | 'defi' | 'nft';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  icon: typeof Wallet;
}

const examples: Example[] = [
  // Web3 Basics
  {
    id: 'wallet-connect',
    title: 'Wallet Connection',
    description: 'Learn how to connect MetaMask and other wallets to your dApp',
    category: 'web3',
    difficulty: 'beginner',
    tags: ['MetaMask', 'ethers.js', 'Wallet'],
    icon: Wallet
  },
  {
    id: 'smart-contract',
    title: 'Smart Contract Interaction',
    description: 'Read and write data to deployed smart contracts',
    category: 'web3',
    difficulty: 'beginner',
    tags: ['Contracts', 'ABI', 'ethers.js'],
    icon: FileCode
  },
  {
    id: 'transaction',
    title: 'Send Transactions',
    description: 'Send ETH and handle transaction lifecycle',
    category: 'web3',
    difficulty: 'beginner',
    tags: ['Transactions', 'Gas', 'Signing'],
    icon: ArrowRightLeft
  },
  {
    id: 'events',
    title: 'Contract Events',
    description: 'Listen to and filter blockchain events in real-time',
    category: 'web3',
    difficulty: 'intermediate',
    tags: ['Events', 'Logs', 'WebSocket'],
    icon: Sparkles
  },
  // Tokens & DeFi
  {
    id: 'erc20-token',
    title: 'ERC-20 Tokens',
    description: 'Create and interact with fungible tokens',
    category: 'defi',
    difficulty: 'intermediate',
    tags: ['ERC-20', 'Tokens', 'Transfer'],
    icon: Coins
  },
  {
    id: 'token-swap',
    title: 'Token Swaps',
    description: 'Build a simple token swap interface',
    category: 'defi',
    difficulty: 'advanced',
    tags: ['DEX', 'Swap', 'Liquidity'],
    icon: ArrowRightLeft
  },
  {
    id: 'staking',
    title: 'Staking Contract',
    description: 'Implement token staking with rewards',
    category: 'defi',
    difficulty: 'advanced',
    tags: ['Staking', 'Rewards', 'DeFi'],
    icon: Coins
  },
  // NFTs
  {
    id: 'nft-minting',
    title: 'NFT Minting',
    description: 'Create and mint ERC-721 NFTs',
    category: 'nft',
    difficulty: 'intermediate',
    tags: ['ERC-721', 'NFT', 'Minting'],
    icon: Image
  },
  {
    id: 'nft-gallery',
    title: 'NFT Gallery',
    description: 'Display NFT collections with metadata',
    category: 'nft',
    difficulty: 'intermediate',
    tags: ['NFT', 'Metadata', 'Gallery'],
    icon: Grid3X3
  },
  {
    id: 'nft-marketplace',
    title: 'NFT Marketplace',
    description: 'Build a basic NFT trading platform',
    category: 'nft',
    difficulty: 'advanced',
    tags: ['Marketplace', 'Trading', 'Escrow'],
    icon: Image
  },
  // AI Examples
  {
    id: 'ai-assistant',
    title: 'AI Code Assistant',
    description: 'AI-powered help for smart contract development',
    category: 'ai',
    difficulty: 'intermediate',
    tags: ['AI', 'Assistant', 'Code'],
    icon: Brain
  },
  {
    id: 'ai-audit',
    title: 'AI Security Audit',
    description: 'Automated vulnerability detection for contracts',
    category: 'ai',
    difficulty: 'advanced',
    tags: ['AI', 'Security', 'Audit'],
    icon: Brain
  },
  // Advanced
  {
    id: 'multi-sig',
    title: 'Multi-Signature Wallet',
    description: 'Build a multi-sig wallet requiring multiple approvals',
    category: 'web3',
    difficulty: 'advanced',
    tags: ['Multi-sig', 'Security', 'Wallet'],
    icon: Wallet
  },
  {
    id: 'dao-voting',
    title: 'DAO Voting',
    description: 'Implement on-chain governance and voting',
    category: 'web3',
    difficulty: 'advanced',
    tags: ['DAO', 'Governance', 'Voting'],
    icon: FileCode
  },
  {
    id: 'cross-chain',
    title: 'Cross-Chain Bridge',
    description: 'Bridge assets between different blockchains',
    category: 'defi',
    difficulty: 'advanced',
    tags: ['Bridge', 'Cross-chain', 'Interoperability'],
    icon: ArrowRightLeft
  }
];

const categories = [
  { id: 'all', label: 'All Examples', icon: Grid3X3 },
  { id: 'web3', label: 'Web3 Basics', icon: Wallet },
  { id: 'defi', label: 'DeFi & Tokens', icon: Coins },
  { id: 'nft', label: 'NFTs', icon: Image },
  { id: 'ai', label: 'AI Integration', icon: Brain }
];

const difficulties = [
  { id: 'all', label: 'All Levels' },
  { id: 'beginner', label: 'Beginner', color: 'green' },
  { id: 'intermediate', label: 'Intermediate', color: 'yellow' },
  { id: 'advanced', label: 'Advanced', color: 'red' }
];

export default function ExamplesPage() {
  useSEO({
    title: 'Examples',
    description: 'Explore working code examples for Web3 development. Token swaps, NFT minting, DAO governance, wallet connections, and more - all with live previews.',
    path: '/examples'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredExamples = useMemo(() => {
    return examples.filter(example => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        example.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        example.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || example.category === selectedCategory;
      
      // Difficulty filter
      const matchesDifficulty = selectedDifficulty === 'all' || example.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'web3': return 'from-blue-500 to-purple-500';
      case 'defi': return 'from-green-500 to-teal-500';
      case 'nft': return 'from-pink-500 to-purple-500';
      case 'ai': return 'from-orange-500 to-red-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Code2 className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold">Code Examples</h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl mb-8">
            Learn Web3 development with interactive, production-ready examples. 
            Each example includes editable code and live preview.
          </p>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search examples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-4">
              {/* Difficulty filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-700 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {difficulties.map(diff => (
                    <option key={diff.id} value={diff.id}>{diff.label}</option>
                  ))}
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Examples Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Showing {filteredExamples.length} of {examples.length} examples
        </p>

        {filteredExamples.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No examples found
            </h3>
            <p className="text-gray-500 dark:text-gray-500">
              Try adjusting your search or filters
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExamples.map(example => (
              <Link
                key={example.id}
                to={`/example/${example.id}`}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                {/* Card Header with gradient */}
                <div className={`h-2 bg-gradient-to-r ${getCategoryColor(example.category)}`} />
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${getCategoryColor(example.category)} text-white`}>
                      <example.icon className="w-6 h-6" />
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(example.difficulty)}`}>
                      {example.difficulty}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {example.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {example.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {example.tags.map(tag => (
                      <span 
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Play className="w-4 h-4" />
                      Interactive Demo
                    </span>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExamples.map(example => (
              <Link
                key={example.id}
                to={`/example/${example.id}`}
                className="group flex items-center gap-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className={`p-3 rounded-xl bg-gradient-to-r ${getCategoryColor(example.category)} text-white flex-shrink-0`}>
                  <example.icon className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {example.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(example.difficulty)}`}>
                      {example.difficulty}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                    {example.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {example.tags.slice(0, 2).map(tag => (
                    <span 
                      key={tag}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors ml-2" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Take your skills to the next level in our interactive sandbox where you can 
            write, compile, and deploy your own smart contracts.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/sandbox"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Play className="w-5 h-5" />
              Open Sandbox
            </Link>
            <Link
              to="/tutorials"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
            >
              <Code2 className="w-5 h-5" />
              View Tutorials
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
