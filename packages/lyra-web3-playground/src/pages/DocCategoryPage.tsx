/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every bug fixed is a lesson learned 🎓
 */

import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  Clock,
  Code2,
  Shield,
  Zap,
  Wallet,
  FileCode,
  Rocket,
  Home
} from 'lucide-react';

interface DocArticle {
  id: string;
  title: string;
  description: string;
  readTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.JSX.Element;
  description: string;
  articles: DocArticle[];
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

export default function DocCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  
  const category = docCategories.find(c => c.id === categoryId);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h1 className="text-2xl font-bold mb-2">Category Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The documentation category you're looking for doesn't exist.
          </p>
          <Link
            to="/docs"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
          >
            <Home className="w-5 h-5" />
            <span>Back to Documentation</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link to="/docs" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white font-medium">{category.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                {category.icon}
              </div>
              <h1 className="text-3xl md:text-4xl font-black">{category.title}</h1>
            </div>
            <p className="text-xl text-blue-100">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Articles List */}
          <div className="space-y-4">
            {category.articles.map((article, index) => (
              <Link
                key={article.id}
                to={`/docs/${category.id}/${article.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all p-6 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h2 className="text-xl font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {article.title}
                      </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 ml-10">
                      {article.description}
                    </p>
                    <div className="flex items-center space-x-3 mt-3 ml-10">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(article.difficulty)}`}>
                        {article.difficulty}
                      </span>
                      <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4 mr-1" />
                        {article.readTime}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          {/* Back Link */}
          <div className="mt-12 text-center">
            <Link
              to="/docs"
              className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Home className="w-5 h-5" />
              <span>Back to all documentation</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
