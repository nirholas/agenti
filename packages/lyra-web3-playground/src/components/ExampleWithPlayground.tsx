/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Code2, 
  Play, 
  Copy, 
  CheckCircle, 
  Maximize2,
  Minimize2,
  Rocket,
  Shield,
  Sparkles
} from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';
import { useThemeStore } from '@/stores/themeStore';

interface ExampleWithPlaygroundProps {
  children: React.ReactNode;
  title: string;
  description: string;
  contractCode: string;
  contractName?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}

export default function ExampleWithPlayground({
  children,
  title,
  description,
  contractCode,
  contractName = 'Contract.sol',
  difficulty = 'intermediate',
  tags = [],
}: ExampleWithPlaygroundProps) {
  const { mode } = useThemeStore();
  const [code, setCode] = useState(contractCode);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  // Fullscreen mode - code only
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900">
        <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center space-x-3 text-white">
            <Code2 className="w-5 h-5" />
            <span className="font-semibold">{contractName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        <Editor
          height="calc(100vh - 56px)"
          language="sol"
          value={code}
          onChange={(value) => setCode(value || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            padding: { top: 16 },
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <span className={`px-2 py-1 text-xs font-medium rounded ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex items-center space-x-2">
          {tags.map(tag => (
            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Wallet Disclaimer - Friendly */}
      <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Learning safely:</strong> When connecting wallets to interact with contracts, 
          we recommend using a dedicated test wallet with only testnet funds. 
          This is great practice for all Web3 development! 🎓
        </div>
      </div>

      {/* Side-by-Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Code Editor */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden order-2 lg:order-1">
          {/* Code Header */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white">
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4" />
              <span className="font-medium text-sm">{contractName}</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Copy code"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="h-[500px]">
            <Editor
              height="100%"
              language="sol"
              value={code}
              onChange={(value) => setCode(value || '')}
              theme={mode === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* Code Footer */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <Play className="w-3 h-3" />
              <span>Edit code, then deploy in sandbox</span>
            </div>
            <a
              href="/sandbox"
              className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <Rocket className="w-4 h-4" />
              <span>Open in Sandbox</span>
            </a>
          </div>
        </div>

        {/* Right: Live Demo Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden order-1 lg:order-2">
          {/* Demo Header */}
          <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium text-sm">Live Preview</span>
            <span className="px-2 py-0.5 text-xs bg-white/20 rounded">Scroll for full demo ↓</span>
          </div>

          {/* Demo Content - Compact Preview */}
          <div className="p-4 max-h-[560px] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Full Width Live Demo Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">Live Demo</span>
            <span className="px-2 py-0.5 text-xs bg-white/20 rounded">Interactive</span>
          </div>
          <span className="text-sm opacity-80">Try it out below!</span>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
