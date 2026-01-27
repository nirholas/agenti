/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 You're part of something special 🎪
 */

/**
 * AboutPage.tsx - About page with project information
 */
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  Heart,
  Github,
  Twitter,
  Globe,
  Code2,
  Rocket,
  Target,
  Sparkles,
  Shield,
  BookOpen,
  Coffee,
  Layers,
  Zap,
  FileCode,
  Coins
} from 'lucide-react';

/** Platform statistics - real counts */
const stats = [
  { icon: <Code2 className="w-6 h-6" />, value: '40+', label: 'Contract Templates' },
  { icon: <BookOpen className="w-6 h-6" />, value: '50+', label: 'Tutorials' },
  { icon: <Layers className="w-6 h-6" />, value: '8', label: 'Chains Supported' },
  { icon: <Shield className="w-6 h-6" />, value: '100%', label: 'Open Source' }
];

/** Core values of the platform */
const values = [
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: 'Education First',
    description: 'Everyone should have access to Web3 education, regardless of background or experience level.'
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: 'Security Focused',
    description: 'Every template and tutorial emphasizes security best practices to help developers write safer code.'
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: 'Hands-On Learning',
    description: 'Learn by doing with interactive examples, live code editing, and real testnet deployments.'
  },
  {
    icon: <Heart className="w-8 h-8" />,
    title: 'Community Driven',
    description: 'Built by the community, for the community. Open source and welcoming contributions.'
  }
];

/** Platform features */
const features = [
  {
    icon: <FileCode className="w-6 h-6" />,
    title: 'Interactive Playground',
    description: 'Write, compile, and deploy Solidity smart contracts directly in your browser with Monaco Editor.'
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: 'Multi-Chain Support',
    description: 'Deploy to Ethereum, Base, Polygon, Avalanche, BSC, Arbitrum, Solana, and Monad.'
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: 'Comprehensive Tutorials',
    description: '50+ tutorials covering everything from Solidity basics to advanced DeFi development.'
  },
  {
    icon: <Code2 className="w-6 h-6" />,
    title: 'Production Templates',
    description: '40+ battle-tested smart contract templates for tokens, NFTs, DeFi, DAOs, and more.'
  },
  {
    icon: <Coins className="w-6 h-6" />,
    title: 'Multi-Chain Support',
    description: 'Deploy to Ethereum, Base, Polygon, Arbitrum, Avalanche, and more testnets with one click.'
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Testnet Deployment',
    description: 'Connect your wallet and deploy contracts to testnets with built-in faucet integration.'
  }
];

export default function AboutPage() {
  useSEO({
    title: 'About Lyra',
    description: 'Lyra is a free, open-source Web3 learning platform. Our mission is to make blockchain development accessible to everyone through interactive tutorials and hands-on coding.',
    path: '/about'
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
              <Heart className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">About Us</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Lyra Web3 Playground
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              An open-source educational platform for learning blockchain development.
              Created by <a href="https://x.com/nichxbt" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">nich (@nichxbt)</a> as a community resource.
            </p>

            <div className="flex items-center justify-center space-x-4">
              <Link
                to="/sandbox"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                <Rocket className="w-5 h-5 inline mr-2" />
                Start Building
              </Link>
              <a
                href="https://github.com/nirholas/lyra-web3-playground"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <Github className="w-5 h-5 inline mr-2" />
                View Source
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <span className="text-blue-600 dark:text-blue-400">{stat.icon}</span>
                </div>
                <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="p-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white">
              <Target className="w-12 h-12 mb-6" />
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-lg text-blue-100">
                Make blockchain development accessible to everyone through interactive 
                learning, production-ready examples, and hands-on experience.
              </p>
            </div>
            
            <div className="p-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl text-white">
              <Sparkles className="w-12 h-12 mb-6" />
              <h2 className="text-3xl font-bold mb-4">Our Vision</h2>
              <p className="text-lg text-purple-100">
                A world where every developer can build secure, efficient smart contracts 
                with confidence, supported by comprehensive educational resources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-100 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-black text-center mb-4">What We Offer</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 text-center mb-12">
            Everything you need to learn and build on blockchain
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <div className="text-blue-600 dark:text-blue-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-black text-center mb-4">Our Values</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 text-center mb-12">
            The principles that guide everything we build
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <div
                key={index}
                className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all text-center"
              >
                <div className="inline-flex p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4 text-blue-600 dark:text-blue-400">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creator Section */}
      <section className="py-20 bg-gray-100 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-6xl mb-6">👨‍💻</div>
            <h2 className="text-3xl font-black mb-4">Created by nich</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Building tools to make Web3 development accessible to everyone.
              This project is open source and community-driven.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a
                href="https://github.com/nirholas"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-all"
                aria-label="GitHub"
              >
                <Github className="w-6 h-6" />
              </a>
              <a
                href="https://x.com/nichxbt"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto p-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white text-center">
            <Globe className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-4xl font-black mb-4">100% Open Source</h2>
            <p className="text-xl text-green-100 mb-8">
              This project is MIT licensed and welcomes contributions from the community.
              Help us build the future of Web3 education.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a
                href="https://github.com/nirholas/lyra-web3-playground"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-green-600 rounded-lg font-bold hover:bg-gray-100 transition-all"
              >
                <Github className="w-5 h-5 inline mr-2" />
                View on GitHub
              </a>
              <Link
                to="/contribute"
                className="px-6 py-3 border-2 border-white/50 rounded-lg font-bold hover:bg-white/10 transition-all"
              >
                Contribution Guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Join Us CTA */}
      <section className="py-20 bg-gray-100 dark:bg-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center p-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white">
            <Coffee className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-4xl font-black mb-4">Join Our Community</h2>
            <p className="text-xl text-blue-100 mb-8">
              Connect with other developers, share your projects, and help us improve the platform.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <a
                href="https://github.com/nirholas/lyra-web3-playground"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-gray-100 transition-all"
              >
                Contribute on GitHub
              </a>
              <a
                href="https://x.com/nichxbt"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 border-2 border-white/50 rounded-lg font-bold hover:bg-white/10 transition-all"
              >
                <Twitter className="w-5 h-5 inline mr-2" />
                Follow on X
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
