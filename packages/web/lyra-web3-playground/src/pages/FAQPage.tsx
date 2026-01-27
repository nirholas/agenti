/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Excellence is a habit, not an act 🌟
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  MessageSquare,
  Book,
  Code2,
  Shield,
  Zap,
  Wallet,
  Users,
  ExternalLink,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful?: number;
}

const faqCategories = [
  { id: 'general', name: 'General', icon: <HelpCircle className="w-5 h-5" /> },
  { id: 'solidity', name: 'Solidity & Smart Contracts', icon: <Code2 className="w-5 h-5" /> },
  { id: 'security', name: 'Security', icon: <Shield className="w-5 h-5" /> },
  { id: 'gas', name: 'Gas & Optimization', icon: <Zap className="w-5 h-5" /> },
  { id: 'wallet', name: 'Wallets & Deployment', icon: <Wallet className="w-5 h-5" /> }
];

const faqs: FAQItem[] = [
  // General
  {
    id: 'what-is-platform',
    question: 'What is Lyra Web3 Playground?',
    answer: 'Lyra Web3 Playground is an open-source, browser-based platform for learning blockchain development. It provides an interactive code playground, a library of contract templates, and step-by-step tutorials to help developers learn and build.',
    category: 'general',
    helpful: 156
  },
  {
    id: 'is-it-free',
    question: 'Is Lyra Web3 Playground free to use?',
    answer: 'Yes — the core features (playground, templates, and tutorials) are free and open source. Some advanced or experimental features may be gated or listed as coming soon.',
    category: 'general',
    helpful: 243
  },
  {
    id: 'need-wallet',
    question: 'Do I need a crypto wallet to use the platform?',
    answer: 'A wallet is not required to read tutorials or edit code. To deploy or interact with contracts on testnets/mainnet you must connect a wallet. Currently MetaMask is supported for browser deployments; WalletConnect support is planned.',
    category: 'general',
    helpful: 189
  },
  {
    id: 'programming-experience',
    question: 'Do I need programming experience?',
    answer: 'Basic programming knowledge helps, but the tutorials start from fundamentals and progress to advanced topics. Hands-on examples are provided so you can learn by doing.',
    category: 'general',
    helpful: 201
  },
  
  // Solidity
  {
    id: 'what-is-solidity',
    question: 'What is Solidity?',
    answer: 'Solidity is the most popular programming language for writing smart contracts on Ethereum and EVM-compatible blockchains. It\'s a statically-typed, contract-oriented language inspired by JavaScript, Python, and C++.',
    category: 'solidity',
    helpful: 312
  },
  {
    id: 'solidity-version',
    question: 'Which Solidity version should I use?',
    answer: 'We recommend using Solidity 0.8.x or later. Version 0.8.0+ includes built-in overflow checking, which prevents many common vulnerabilities. Our platform defaults to 0.8.20 but supports older versions if needed.',
    category: 'solidity',
    helpful: 178
  },
  {
    id: 'openzeppelin',
    question: 'What is OpenZeppelin and why should I use it?',
    answer: 'OpenZeppelin provides secure, audited smart contract libraries for common patterns like ERC-20 tokens, NFTs, access control, and more. Using these battle-tested contracts reduces security risks and saves development time.',
    category: 'solidity',
    helpful: 234
  },
  
  // Security
  {
    id: 'reentrancy',
    question: 'What is a reentrancy attack?',
    answer: 'A reentrancy attack occurs when a malicious contract exploits the order of operations in your code, calling back into your contract before the first execution is complete. This can drain funds. Use the Checks-Effects-Interactions pattern or ReentrancyGuard to prevent it.',
    category: 'security',
    helpful: 289
  },
  {
    id: 'audit',
    question: 'Do I need a security audit?',
    answer: 'For production contracts handling real value, a professional audit is highly recommended. Our Exploit Lab can help you identify common vulnerabilities during development, but it\'s not a replacement for a thorough audit by security professionals.',
    category: 'security',
    helpful: 156
  },
  {
    id: 'common-vulnerabilities',
    question: 'What are the most common smart contract vulnerabilities?',
    answer: 'Common vulnerabilities include: 1) Reentrancy, 2) Access control mistakes, 3) Incorrect assumptions about token behavior, 4) Oracle manipulation, and 5) Unchecked external calls. Use established patterns (OpenZeppelin), audits, and thorough tests to reduce risk.',
    category: 'security',
    helpful: 345
  },
  
  // Gas
  {
    id: 'what-is-gas',
    question: 'What is gas and why does it matter?',
    answer: 'Gas is the unit of computational work on EVM chains. Each transaction consumes gas and is paid in the chain\'s native token. Optimizing gas can significantly reduce costs for users. Tutorials include practical tips for gas optimisation.',
    category: 'gas',
    helpful: 267
  },
  {
    id: 'reduce-gas',
    question: 'How can I reduce gas costs?',
    answer: 'Key optimization strategies: 1) Use smaller data types when possible (uint8 vs uint256), 2) Pack storage variables, 3) Avoid loops over dynamic arrays, 4) Use events instead of storage for historical data, 5) Batch operations, 6) Use external vs public for functions called externally.',
    category: 'gas',
    helpful: 398
  },
  
  // Wallet
  {
    id: 'connect-wallet',
    question: 'How do I connect my wallet?',
    answer: 'Click the "Connect Wallet" button in the top right corner. Currently MetaMask is supported for in-browser deployments; other wallet integrations may be added in future releases. Ensure your wallet is set to the intended network before deploying.',
    category: 'wallet',
    helpful: 145
  },
  {
    id: 'testnet-tokens',
    question: 'How do I get testnet tokens?',
    answer: 'Use public faucets for the target testnet (e.g., Sepolia Faucet, Mumbai Faucet). The docs include links and guidance for requesting testnet funds; some environments may offer built-in faucet helpers if a backend is configured.',
    category: 'wallet',
    helpful: 223
  },
  {
    id: 'deploy-mainnet',
    question: 'How do I deploy to mainnet?',
    answer: 'First, thoroughly test on testnets and consider a security audit. Then connect your wallet to mainnet, ensure you have enough ETH for gas, and use the Deploy button. We recommend starting with lower-value use cases.',
    category: 'wallet',
    helpful: 178
  },
  
  // Future / Roadmap
  {
    id: 'ai-roadmap',
    question: 'Does the platform include AI features?',
    answer: 'Some AI-assisted features are planned, but are not required to use the core playground. Any AI capabilities will be clearly marked in the UI as experimental or coming soon. Always validate suggestions and perform tests/audits before deploying production code.',
    category: 'general',
    helpful: 42
  }
];

export default function FAQPage() {
  useSEO({
    title: 'FAQ - Frequently Asked Questions',
    description: 'Get answers to common questions about Solidity development, smart contract security, gas optimization, wallet integration, and blockchain deployment.',
    path: '/faq'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, 'up' | 'down' | null>>({});

  const toggleItem = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = !searchQuery || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const voteHelpful = (id: string, vote: 'up' | 'down') => {
    setHelpfulVotes(prev => ({
      ...prev,
      [id]: prev[id] === vote ? null : vote
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <HelpCircle className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Find answers to common questions about Web3 development
          </p>
          
          {/* Search */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All Questions
            </button>
            {faqCategories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {category.icon}
                <span>{category.name}</span>
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-4">
            {filteredFaqs.map(faq => (
              <div
                key={faq.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-semibold text-lg pr-4">{faq.question}</span>
                  {expandedItems.includes(faq.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {expandedItems.includes(faq.id) && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {faq.answer}
                    </p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-500">Was this helpful?</span>
                        <button
                          onClick={() => voteHelpful(faq.id, 'up')}
                          className={`p-2 rounded-lg transition-colors ${
                            helpfulVotes[faq.id] === 'up'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => voteHelpful(faq.id, 'down')}
                          className={`p-2 rounded-lg transition-colors ${
                            helpfulVotes[faq.id] === 'down'
                              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-400">
                          {faq.helpful} found this helpful
                        </span>
                      </div>
                      
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-400">
                        {faqCategories.find(c => c.id === faq.category)?.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredFaqs.length === 0 && (
            <div className="text-center py-12">
              <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="text-xl font-bold mb-2">No questions found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your search or filter
              </p>
            </div>
          )}

          {/* Still Need Help */}
          <div className="mt-12 p-8 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Our community is here to help you succeed
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a
                href="https://github.com/nirholas/lyra-web3-playground/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center space-x-2"
              >
                <span>Ask on GitHub</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <Link
                to="/docs"
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center space-x-2"
              >
                <Book className="w-4 h-4" />
                <span>Read Documentation</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
