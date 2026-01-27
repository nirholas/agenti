/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

/**
 * ChangelogPage.tsx - Version history and release notes
 */
import { Sparkles, Rocket, Code2, BookOpen, Layers, Coins, Shield, Wrench } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

interface Release {
  version: string;
  date: string;
  highlights: string[];
  tag: 'major' | 'minor' | 'patch';
  icon: React.JSX.Element;
}

const releases: Release[] = [
  {
    version: 'v1.4.0',
    date: 'December 2024',
    tag: 'major',
    icon: <Sparkles className="w-5 h-5" />,
    highlights: [
      'NEW: Wallet-Only Authentication - No email/password required!',
      'NEW: Market Data Integration - Live crypto prices and DeFi analytics',
      'NEW: Markets Page - Comprehensive dashboard at /markets',
      'NEW: Price Ticker - Real-time prices from CoinGecko',
      'NEW: DeFi Widgets - Protocol TVL, yields, and chain statistics',
      'Community features now use wallet connect instead of Supabase auth',
      'Added useMarketData hooks for easy integration',
      'CoinGecko API for crypto prices, trending coins, and charts',
      'DeFiLlama API for protocol TVL, yields, and chain data',
      'Improved accessibility with ARIA labels throughout',
      'Mobile bottom navigation component'
    ]
  },
  {
    version: 'v1.3.0',
    date: 'December 2024',
    tag: 'major',
    icon: <Layers className="w-5 h-5" />,
    highlights: [
      'NEW: Community Features - Share your projects with the world!',
      'NEW: Explore Page - Discover projects from other developers',
      'NEW: Project Sharing - Public and unlisted visibility options',
      'NEW: Social Features - Like, comment, and fork projects',
      'NEW: Embed Code - Add shared projects to external sites',
      'Share Modal with category and tag support',
      'Project detail pages with full code viewer',
      'Comment system for project discussions',
      'Fork projects to create your own version',
      'View counts and engagement statistics',
      'Twitter sharing integration'
    ]
  },
  {
    version: 'v1.2.0',
    date: 'December 2024',
    tag: 'major',
    icon: <Layers className="w-5 h-5" />,
    highlights: [
      'NEW: Premium Code Sandbox - World-class IDE rivaling CodePen, JSFiddle, and Remix',
      'NEW: Web Sandbox - Multi-file projects with HTML, CSS, JS, React, Vue, and Python support',
      'NEW: Solidity IDE - Professional smart contract development with multiple compiler versions (0.6.x-0.8.24)',
      'NEW: Unified Sandbox - All examples now feature full-stack dApp development with auto-generated frontends',
      'Device presets for responsive testing (Desktop, Tablet, Mobile)',
      'Split-pane layouts with draggable resize',
      'Console panel with log/warn/error capture',
      'Contract interaction panel - deploy, call functions, track transactions',
      'Editor settings: Theme, font size, Vim mode, auto-save, and more',
      'Keyboard shortcuts (Ctrl+S to compile/run)',
      'Export & share functionality'
    ]
  },
  {
    version: 'v1.1.0',
    date: 'December 2024',
    tag: 'minor',
    icon: <Sparkles className="w-5 h-5" />,
    highlights: [
      'Added token consolidation tool for dust sweeping and cross-chain bridging',
      'Expanded template library to 40+ production-ready smart contracts',
      'Added 50+ comprehensive tutorials covering beginner to expert topics',
      'Multi-chain support for 8 networks: Ethereum, Base, Polygon, Avalanche, BSC, Arbitrum, Solana, Monad'
    ]
  },
  {
    version: 'v1.0.0',
    date: 'December 2024',
    tag: 'major',
    icon: <Rocket className="w-5 h-5" />,
    highlights: [
      'Initial release of Lyra Web3 Playground',
      'Interactive Solidity playground with Monaco Editor',
      'Browser-based Solidity compilation (no backend required)',
      'MetaMask wallet integration for testnet deployment',
      'Basic template library with ERC-20, ERC-721, and DeFi examples',
      'Tutorial system with interactive code blocks',
      'Dark mode support and responsive design'
    ]
  }
];

const tagStyles: Record<Release['tag'], string> = {
  major: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200',
  minor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  patch: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
};

export default function ChangelogPage() {
  useSEO({
    title: 'Changelog',
    description: 'View the latest updates, new features, and improvements to Lyra Web3 Playground. Stay up to date with our development progress.',
    path: '/changelog'
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold shadow-lg">
            <Sparkles className="w-4 h-4" />
            <span>Changelog</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mt-4">What's New</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-4 max-w-3xl mx-auto">
            Track the latest updates and improvements to Lyra Web3 Playground.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Timeline line */}
          <div className="absolute left-6 md:left-12 top-0 bottom-0 border-l-2 border-dashed border-gray-200 dark:border-gray-700" aria-hidden="true" />
          
          <div className="space-y-8">
            {releases.map((release) => (
              <div key={release.version} className="relative pl-12 md:pl-20">
                {/* Timeline dot */}
                <div className="absolute left-3 md:left-9 w-6 h-6 rounded-full bg-white dark:bg-gray-900 border-4 border-purple-500 shadow" aria-hidden="true" />
                
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-purple-600">
                        {release.icon}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h2 className="text-xl font-bold">{release.version}</h2>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${tagStyles[release.tag]}`}>
                            {release.tag}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{release.date}</p>
                      </div>
                    </div>
                    <Code2 className="w-5 h-5 text-purple-500" />
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-3">
                    {release.highlights.map((item, i) => (
                      <div key={i} className="flex items-start space-x-3">
                        <span className="mt-2 w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" aria-hidden="true" />
                        <p className="text-gray-700 dark:text-gray-200">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-3 mb-4">
              <Rocket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold">Coming Soon</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We're actively working on new features. Check out our projects to see what's next!
            </p>
            <a
              href="/projects"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <span>View Projects</span>
            </a>
          </div>
        </div>

        {/* Contribute Section */}
        <div className="mt-8 max-w-4xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Want to contribute to the next release?
          </p>
          <a
            href="https://github.com/nirholas/lyra-web3-playground"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-medium hover:underline"
          >
            <span>Contribute on GitHub</span>
          </a>
        </div>
      </div>
    </div>
  );
}
