/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every semicolon has a purpose 😊
 */

import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  Brain,
  History,
  Shield,
  Users,
  Zap,
  Sparkles,
  Rocket,
  Target,
  Award,
  TrendingUp,
  Code2,
  Heart,
  Globe,
  ArrowRight
} from 'lucide-react';

export default function InnovationShowcase() {
  useSEO({
    title: 'Innovation Lab',
    description: 'Cutting-edge Web3 development tools: AI Code Whisperer, Contract Time Machine, Exploit Lab, Neural Gas Oracle, and Cross-Chain DreamWeaver.',
    path: '/innovation'
  });

  const features = [
    {
      icon: <Brain className="w-12 h-12" />,
      title: 'AI Code Whisperer',
      description: 'Real-time AI analysis with voice control. Detects vulnerabilities, optimizes gas, and suggests improvements as you type.',
      gradient: 'from-purple-600 to-blue-600',
      stats: ['94% accuracy', 'Voice-enabled', 'Auto-fix'],
      demo: 'Live vulnerability detection in milliseconds',
      link: '/innovation/ai-whisperer'
    },
    {
      icon: <History className="w-12 h-12" />,
      title: 'Contract Time Machine',
      description: 'Travel through your code\'s evolution. Fork realities, simulate futures, and explore alternative implementations.',
      gradient: 'from-indigo-600 to-purple-600',
      stats: ['Time travel', 'Fork realities', 'Predict outcomes'],
      demo: 'Replay your entire development journey',
      link: '/innovation/time-machine'
    },
    {
      icon: <Shield className="w-12 h-12" />,
      title: 'Ethical Exploit Lab',
      description: 'Learn security by attacking your own contracts. Test reentrancy, overflows, and flash loan attacks in a safe sandbox.',
      gradient: 'from-red-600 to-orange-600',
      stats: ['6 attack vectors', '100% ethical', 'Real exploits'],
      demo: 'Hack yourself before hackers do',
      link: '/innovation/exploit-lab'
    },
    {
      icon: <Users className="w-12 h-12" />,
      title: 'Collaborative Arena',
      description: 'Code with AI teammates. Compete in challenges, earn bounties, and learn from AI mentors in real-time.',
      gradient: 'from-violet-600 to-fuchsia-600',
      stats: ['Live collab', 'AI teammates', 'Earn rewards'],
      demo: 'Multi-player coding with AI assistants',
      link: '/innovation/arena'
    },
    {
      icon: <Zap className="w-12 h-12" />,
      title: 'Neural Gas Oracle',
      description: 'ML-powered gas optimization. Train neural networks on 100k+ contracts to predict and reduce gas costs.',
      gradient: 'from-cyan-600 to-blue-600',
      stats: ['3 ML models', 'Live predictions', '70% savings'],
      demo: 'AI learns from blockchain to save you gas',
      link: '/innovation/gas-oracle'
    },
    {
      icon: <Globe className="w-12 h-12" />,
      title: 'Cross-Chain Dream Weaver',
      description: 'Deploy to 8+ blockchains with one click. Smart AI deployment, auto-bridge setup, and cost optimization.',
      gradient: 'from-emerald-600 to-teal-600',
      stats: ['8+ chains', 'Auto-bridge', 'One-click deploy'],
      demo: 'One contract, infinite chains',
      link: '/innovation/cross-chain'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl top-1/2 -right-48 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-96 h-96 bg-pink-500/20 rounded-full blur-3xl -bottom-48 left-1/2 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-500/20 backdrop-blur-lg rounded-full mb-6 border border-amber-500/40">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">🧪 Concept Demos • Experimental Features</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          
          <h1 className="text-7xl font-black mb-6 bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            The Future of<br />Web3 Development
          </h1>
          
          <p className="text-2xl text-purple-200 mb-4 max-w-3xl mx-auto">
            AI-powered, time-traveling, vulnerability-testing, collaborative coding platform
            that makes building smart contracts feel like magic ✨
          </p>
          
          <p className="text-sm text-amber-300/80 mb-8 max-w-2xl mx-auto bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
            ⚠️ These features are concept demonstrations showcasing future capabilities.
            Some functionality is simulated for illustration purposes.
          </p>

          <div className="flex items-center justify-center space-x-4 mb-12">
            <Link
              to="/sandbox"
              className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-2xl hover:shadow-purple-500/50 hover:scale-105 flex items-center space-x-2"
            >
              <Rocket className="w-6 h-6 group-hover:animate-bounce" />
              <span>Launch Innovation Mode</span>
            </Link>
            <Link
              to="/examples"
              className="px-8 py-4 bg-white/10 backdrop-blur-lg rounded-xl font-bold text-lg hover:bg-white/20 transition-all border-2 border-white/20 hover:border-white/40"
            >
              View Examples
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { icon: <Brain />, label: 'AI Concepts', value: '5+' },
              { icon: <Target />, label: 'Demo Features', value: '6' },
              { icon: <Shield />, label: 'Attack Types', value: '6' },
              { icon: <Award />, label: 'Learning Paths', value: '3' }
            ].map((stat, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-purple-200">
                  {stat.icon}
                  <span>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="space-y-8 mb-20">
          <div className="text-center mb-12">
            <h2 className="text-5xl font-black mb-4">Innovation Lab</h2>
            <p className="text-xl text-purple-200">
              Exploring the future of Web3 development. These concept demos showcase what's possible.
            </p>
            <span className="inline-block mt-3 px-3 py-1 bg-amber-500/20 text-amber-300 text-sm rounded-full border border-amber-500/30">
              🔬 Experimental • Concept Demos
            </span>
          </div>

          {features.map((feature, index) => (
            <div
              key={index}
              className={`bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:border-white/40 transition-all hover:scale-[1.02] ${
                index % 2 === 0 ? 'ml-0 mr-12' : 'ml-12 mr-0'
              }`}
            >
              <div className="flex items-start space-x-6">
                <div className={`p-6 rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-2xl`}>
                  {feature.icon}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-3xl font-bold">{feature.title}</h3>
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                      Concept Demo
                    </span>
                  </div>
                  <p className="text-lg text-purple-200 mb-4">{feature.description}</p>
                  
                  <div className="flex items-center space-x-4 mb-4">
                    {feature.stats.map((stat, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-yellow-400 font-medium">
                      <Sparkles className="w-5 h-5" />
                      <span>{feature.demo}</span>
                    </div>
                    
                    <Link
                      to={feature.link}
                      className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${feature.gradient} rounded-lg font-semibold text-sm hover:opacity-90 transition-all hover:scale-105 shadow-lg`}
                    >
                      Try It
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-12 border border-white/20 mb-20">
          <h2 className="text-4xl font-black text-center mb-12">How It Works</h2>
          
          <div className="grid grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Write Code',
                description: 'Start coding in the interactive sandbox with syntax highlighting and autocomplete',
                icon: <Code2 className="w-8 h-8" />
              },
              {
                step: '2',
                title: 'AI Analyzes',
                description: 'Real-time AI detects vulnerabilities, optimizes gas, and suggests improvements',
                icon: <Brain className="w-8 h-8" />
              },
              {
                step: '3',
                title: 'Deploy & Learn',
                description: 'Test exploits, collaborate with AI, and travel through code history',
                icon: <Rocket className="w-8 h-8" />
              }
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br ${
                  i === 0 ? 'from-purple-600 to-blue-600' :
                  i === 1 ? 'from-pink-600 to-purple-600' :
                  'from-blue-600 to-cyan-600'
                } flex items-center justify-center shadow-2xl`}>
                  {step.icon}
                </div>
                <div className="text-6xl font-black text-white/20 mb-2">{step.step}</div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-purple-200">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="text-center mb-20">
          <h2 className="text-4xl font-black mb-8">Powered By Cutting-Edge AI</h2>
          <div className="flex items-center justify-center space-x-8 flex-wrap gap-4">
            {[
              'LSTM Networks',
              'Transformer Models',
              'Pattern Recognition',
              'Real-time Analysis',
              'Neural Gas Prediction',
              'Voice Control'
            ].map((tech, i) => (
              <div
                key={i}
                className="px-6 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl border border-white/20 font-bold"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-12 text-center">
          <h2 className="text-5xl font-black mb-6">Ready to Experience the Future?</h2>
          <p className="text-2xl mb-8 text-white/90">
            Join thousands of developers learning Web3 with AI superpowers
          </p>
          <Link
            to="/sandbox"
            className="inline-flex items-center space-x-3 px-10 py-5 bg-white text-purple-600 rounded-xl font-black text-xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-white/50 hover:scale-110"
          >
            <Rocket className="w-8 h-8" />
            <span>Start Building Now</span>
            <Sparkles className="w-6 h-6" />
          </Link>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-16 text-purple-300">
          <Heart className="w-6 h-6 inline text-pink-500 animate-pulse" />
          <p className="mt-4">
            Built with passion for the Web3 community
          </p>
          <p className="text-sm mt-2 text-purple-400">
            Featuring AI Code Whisperer • Time Machine • Exploit Lab • Collaborative Arena • Neural Gas Oracle
          </p>
        </div>
      </div>
    </div>
  );
}
