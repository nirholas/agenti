/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 You're doing incredible things 🎯
 */

import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import WebSandbox from '@/components/Sandbox/WebSandbox';
import SoliditySandbox from '@/components/Sandbox/SoliditySandbox';
import { Code2, FileCode, Layers, Sparkles, Zap, Globe, ArrowRight, Home } from 'lucide-react';
import { cn } from '@/utils/helpers';

type SandboxType = 'web' | 'solidity' | null;

export default function SandboxPage() {
  useSEO({
    title: 'IDE - Online Solidity & Web Development',
    description: 'Free browser-based IDE for Solidity and web development. Compile smart contracts, deploy to testnets, and build full-stack dApps with live preview.',
    path: '/ide'
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const [selectedType, setSelectedType] = useState<SandboxType>(
    typeParam === 'web' || typeParam === 'solidity' ? typeParam : null
  );

  const selectType = (type: SandboxType) => {
    setSelectedType(type);
    if (type) {
      setSearchParams({ type });
    }
  };

  // If a type is selected, show that sandbox
  if (selectedType === 'web') {
    return <WebSandbox />;
  }

  if (selectedType === 'solidity') {
    return <SoliditySandbox />;
  }

  // Otherwise, show the selection screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center h-12 px-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
          <span className="text-sm font-medium">Home</span>
        </Link>
        <div className="ml-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-medium text-white">Lyra UDE</span>
        </div>
      </header>

      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Premium Development Environment</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Code Sandbox
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A world-class development environment. Write, compile, deploy, and test
            your code in real-time with instant previews and professional tools.
          </p>
        </div>

        {/* Sandbox Options */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full">
          {/* Web Sandbox */}
          <button
            onClick={() => selectType('web')}
            className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-left hover:border-primary-500/50 hover:bg-gray-800/70 transition-all duration-300 overflow-hidden"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Icon */}
            <div className="relative mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <Globe className="w-8 h-8 text-white" />
              </div>
            </div>
            
            {/* Content */}
            <div className="relative">
              <h2 className="text-2xl font-bold mb-3 group-hover:text-primary-400 transition-colors">
                Web Sandbox
              </h2>
              <p className="text-gray-400 mb-6">
                Build web applications with HTML, CSS, JavaScript, React, Vue, Python, and more.
                Real-time preview with hot reloading.
              </p>
              
              {/* Features */}
              <div className="space-y-2 mb-6">
                {[
                  'Multi-file project support',
                  'Live preview with hot reload',
                  'React & Vue support',
                  'Python execution (Pyodide)',
                  'Console & DevTools',
                  'Export & share projects'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <Zap className="w-4 h-4 text-primary-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Languages */}
              <div className="flex flex-wrap gap-2">
                {['HTML', 'CSS', 'JS', 'React', 'Vue', 'Python'].map(lang => (
                  <span
                    key={lang}
                    className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-md"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Arrow */}
            <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
              <ArrowRight className="w-6 h-6 text-primary-400" />
            </div>
          </button>

          {/* Solidity Sandbox */}
          <button
            onClick={() => selectType('solidity')}
            className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 text-left hover:border-purple-500/50 hover:bg-gray-800/70 transition-all duration-300 overflow-hidden"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Icon */}
            <div className="relative mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <FileCode className="w-8 h-8 text-white" />
              </div>
            </div>
            
            {/* Content */}
            <div className="relative">
              <h2 className="text-2xl font-bold mb-3 group-hover:text-purple-400 transition-colors">
                Solidity UDE
              </h2>
              <p className="text-gray-400 mb-6">
                Build smart contracts with our professional Solidity development environment.
                Better than Remix.
              </p>
              
              {/* Features */}
              <div className="space-y-2 mb-6">
                {[
                  'Multiple compiler versions',
                  'Real-time compilation',
                  'Deploy to testnet/mainnet',
                  'Contract interaction UI',
                  'Transaction history',
                  'ABI & bytecode export'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {['Solidity', 'EVM', 'Web3', 'Ethereum', 'Polygon'].map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Arrow */}
            <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
              <ArrowRight className="w-6 h-6 text-purple-400" />
            </div>
          </button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '10+', label: 'Languages' },
            { value: '100ms', label: 'Hot Reload' },
            { value: '0.8.24', label: 'Solidity' },
            { value: '∞', label: 'Possibilities' },
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-gray-500 text-sm">
          <p>Built with ❤️ for developers who demand the best</p>
        </div>
      </div>
    </div>
  );
}
