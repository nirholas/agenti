/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your dedication inspires others 🌠
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  BookOpen,
  Search,
  Code2,
  Shield,
  Zap,
  Wallet,
  FileCode,
  Terminal,
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle,
  Sparkles,
  Users,
  Rocket,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

interface DocCategory {
  id: string;
  title: string;
  icon: React.JSX.Element;
  description: string;
  articles: DocArticle[];
}

interface DocArticle {
  id: string;
  title: string;
  description: string;
  readTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content?: string;
}

const docCategories: DocCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <Rocket className="w-6 h-6" />,
    description: 'New to the platform? Start here',
    articles: [
      { id: 'intro', title: 'Introduction to Lyra Web3 Playground', description: 'Learn what this platform can do for you', readTime: '5 min', difficulty: 'beginner' },
      { id: 'first-contract', title: 'Your First Smart Contract', description: 'Write, compile, and deploy in 10 minutes', readTime: '10 min', difficulty: 'beginner' },
      { id: 'sandbox-basics', title: 'Understanding the Sandbox', description: 'Navigate the interactive development environment', readTime: '7 min', difficulty: 'beginner' },
      { id: 'innovation-mode', title: 'Activating Innovation Mode', description: 'Unlock AI-powered features', readTime: '5 min', difficulty: 'beginner' }
    ]
  },
  {
    id: 'solidity',
    title: 'Solidity Fundamentals',
    icon: <Code2 className="w-6 h-6" />,
    description: 'Master the language of smart contracts',
    articles: [
      { id: 'solidity-basics', title: 'Solidity Syntax Basics', description: 'Variables, types, and functions', readTime: '15 min', difficulty: 'beginner' },
      { id: 'data-structures', title: 'Data Structures', description: 'Arrays, mappings, and structs', readTime: '12 min', difficulty: 'intermediate' },
      { id: 'inheritance', title: 'Contract Inheritance', description: 'Building on existing contracts', readTime: '10 min', difficulty: 'intermediate' },
      { id: 'modifiers', title: 'Function Modifiers', description: 'Access control and reusability', readTime: '8 min', difficulty: 'intermediate' },
      { id: 'events', title: 'Events and Logging', description: 'Communicate with the frontend', readTime: '10 min', difficulty: 'intermediate' }
    ]
  },
  {
    id: 'security',
    title: 'Smart Contract Security',
    icon: <Shield className="w-6 h-6" />,
    description: 'Build secure, auditable contracts',
    articles: [
      { id: 'common-vulnerabilities', title: 'Common Vulnerabilities', description: 'Top 10 smart contract security issues', readTime: '20 min', difficulty: 'intermediate' },
      { id: 'reentrancy', title: 'Reentrancy Attacks Explained', description: 'How they work and how to prevent them', readTime: '15 min', difficulty: 'advanced' },
      { id: 'access-control', title: 'Access Control Patterns', description: 'Secure your contract functions', readTime: '12 min', difficulty: 'intermediate' },
      { id: 'audit-checklist', title: 'Security Audit Checklist', description: 'Pre-deployment security review', readTime: '10 min', difficulty: 'advanced' }
    ]
  },
  {
    id: 'gas-optimization',
    title: 'Gas Optimization',
    icon: <Zap className="w-6 h-6" />,
    description: 'Write efficient, cost-effective code',
    articles: [
      { id: 'gas-basics', title: 'Understanding Gas', description: 'How Ethereum pricing works', readTime: '10 min', difficulty: 'beginner' },
      { id: 'storage-optimization', title: 'Storage Optimization', description: 'Reduce costly storage operations', readTime: '15 min', difficulty: 'intermediate' },
      { id: 'loop-optimization', title: 'Optimizing Loops', description: 'Avoid expensive iterations', readTime: '12 min', difficulty: 'intermediate' },
      { id: 'packed-storage', title: 'Packed Storage', description: 'Advanced variable packing', readTime: '10 min', difficulty: 'advanced' }
    ]
  },
  {
    id: 'defi',
    title: 'DeFi Development',
    icon: <Wallet className="w-6 h-6" />,
    description: 'Build decentralized finance applications',
    articles: [
      { id: 'defi-intro', title: 'Introduction to DeFi', description: 'Understand the DeFi ecosystem', readTime: '15 min', difficulty: 'beginner' },
      { id: 'token-creation', title: 'Creating ERC-20 Tokens', description: 'Build your own fungible token', readTime: '20 min', difficulty: 'intermediate' },
      { id: 'liquidity-pools', title: 'Liquidity Pools', description: 'How AMMs work', readTime: '18 min', difficulty: 'advanced' },
      { id: 'yield-farming', title: 'Yield Farming Mechanics', description: 'Staking and rewards', readTime: '15 min', difficulty: 'advanced' }
    ]
  },
  {
    id: 'templates',
    title: 'Templates & Playground',
    icon: <FileCode className="w-6 h-6" />,
    description: 'How to use contract templates and the interactive playground',
    articles: [
      { id: 'using-templates', title: 'Using Contract Templates', description: 'Browse, customize, and deploy templates', readTime: '8 min', difficulty: 'beginner' },
      { id: 'deploy-testnets', title: 'Deploying to Testnets', description: 'Guide to deploying contracts to Sepolia, Mumbai, and other testnets', readTime: '10 min', difficulty: 'intermediate' },
      { id: 'tutorials-guide', title: 'Following Tutorials', description: 'How tutorial progress and checkpoints work', readTime: '6 min', difficulty: 'beginner' },
      { id: 'contributing-docs', title: 'Contributing to Docs & Templates', description: 'How to submit improvements and new templates', readTime: '6 min', difficulty: 'beginner' }
    ]
  }
];

const quickLinks = [
  { title: 'Quick Start Guide', path: '/docs/getting-started/intro', icon: <Rocket /> },
  { title: 'API Reference', path: '/docs/api', icon: <FileCode /> },
  { title: 'Example Contracts', path: '/examples', icon: <Code2 /> },
  { title: 'FAQ', path: '/faq', icon: <HelpCircle /> }
];

export default function DocsPage() {
  useSEO({
    title: 'Documentation',
    description: 'Comprehensive documentation for Lyra Web3 Playground. Learn Solidity, smart contract development, DeFi protocols, NFT standards, and more.',
    path: '/docs'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredCategories = docCategories.filter(category => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      category.title.toLowerCase().includes(query) ||
      category.articles.some(article => 
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query)
      )
    );
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-6 opacity-80" />
            <h1 className="text-4xl md:text-5xl font-black mb-4">Documentation</h1>
            <p className="text-xl text-blue-100 mb-8">
              Everything you need to build amazing smart contracts
            </p>
            
            {/* Search */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Quick Links */}
        <div className="max-w-6xl mx-auto mb-12">
          <h2 className="text-lg font-bold mb-4 text-gray-600 dark:text-gray-400">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link, index) => (
              <Link
                key={index}
                to={link.path}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all flex items-center space-x-3 group"
              >
                <span className="text-blue-600 dark:text-blue-400">{link.icon}</span>
                <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {link.title}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all"
              >
                {/* Category Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                      {category.icon}
                    </div>
                    <h3 className="text-xl font-bold">{category.title}</h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {category.description}
                  </p>
                </div>

                {/* Articles List */}
                <div className="p-4">
                  {category.articles.slice(0, 4).map((article) => (
                    <Link
                      key={article.id}
                      to={`/docs/${category.id}/${article.id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {article.title}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {article.description}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(article.difficulty)}`}>
                          {article.difficulty}
                        </span>
                        <span className="text-xs text-gray-400">
                          {article.readTime}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {category.articles.length > 4 && (
                    <Link
                      to={`/docs/${category.id}`}
                      className="block text-center py-3 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                    >
                      View all {category.articles.length} articles →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Code Section */}
        <div className="max-w-6xl mx-auto mt-16">
          <h2 className="text-2xl font-bold mb-6">Quick Code Examples</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Example 1 */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                <span className="text-sm text-gray-400">Simple Token</span>
                <button
                  onClick={() => copyCode('pragma solidity ^0.8.19;\n\nimport "@openzeppelin/contracts/token/ERC20/ERC20.sol";\n\ncontract MyToken is ERC20 {\n    constructor() ERC20("MyToken", "MTK") {\n        _mint(msg.sender, 1000000 * 10 ** decimals());\n    }\n}')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {copiedCode ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
                <code>{`pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}`}</code>
              </pre>
            </div>

            {/* Example 2 */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                <span className="text-sm text-gray-400">Simple NFT</span>
                <button
                  onClick={() => copyCode('pragma solidity ^0.8.19;\n\nimport "@openzeppelin/contracts/token/ERC721/ERC721.sol";\n\ncontract MyNFT is ERC721 {\n    uint256 private _tokenIdCounter;\n\n    constructor() ERC721("MyNFT", "MNFT") {}\n\n    function mint() public {\n        _safeMint(msg.sender, _tokenIdCounter++);\n    }\n}')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {copiedCode ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
                <code>{`pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MyNFT is ERC721 {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MyNFT", "MNFT") {}

    function mint() public {
        _safeMint(msg.sender, _tokenIdCounter++);
    }
}`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Help CTA */}
        <div className="max-w-4xl mx-auto mt-16 text-center p-12 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold mb-4">Can't find what you're looking for?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Join our community and get help from thousands of developers
          </p>
          <div className="flex items-center justify-center space-x-4">
            <a
              href="https://github.com/nirholas/lyra-web3-playground/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
            >
              Ask on GitHub
            </a>
            <Link
              to="/faq"
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              View FAQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
