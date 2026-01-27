/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Persistence beats perfection 🎖️
 */

import { useState } from 'react';
import { Copy, Check, Download, Share2, BookOpen, Code2 } from 'lucide-react';

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  category: string;
  tags: string[];
  productionReady: boolean;
}

interface CodeSnippetManagerProps {
  snippets: CodeSnippet[];
  onInsert?: (code: string) => void;
}

export default function CodeSnippetManager({ 
  snippets, 
  onInsert 
}: CodeSnippetManagerProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(snippets.map(s => s.category))];

  const filteredSnippets = snippets.filter(snippet => {
    const matchesSearch = 
      snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || snippet.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleCopy = async (snippet: CodeSnippet) => {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(snippet.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (snippet: CodeSnippet) => {
    const blob = new Blob([snippet.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snippet.title.toLowerCase().replace(/\s+/g, '-')}.${getFileExtension(snippet.language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async (snippet: CodeSnippet) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: snippet.title,
          text: snippet.description,
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy link to clipboard
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const getFileExtension = (language: string): string => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      solidity: 'sol',
      react: 'tsx',
      vue: 'vue',
      python: 'py',
      rust: 'rs',
      html: 'html',
      css: 'css'
    };
    return extensions[language] || 'txt';
  };

  const getLanguageColor = (language: string): string => {
    const colors: Record<string, string> = {
      javascript: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      solidity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      react: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      vue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      python: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      rust: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    return colors[language] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Code Snippets Library
            </h2>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {filteredSnippets.length} snippets
          </span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search snippets by name, description, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
        />

        {/* Category Filter */}
        <div className="flex items-center space-x-2 mt-3 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Snippets List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <Code2 className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">No snippets found</p>
            <p className="text-sm mt-2">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                {/* Snippet Header */}
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {snippet.title}
                        </h3>
                        {snippet.productionReady && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                            Production Ready
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {snippet.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getLanguageColor(snippet.language)}`}>
                          {snippet.language}
                        </span>
                        {snippet.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Code Preview */}
                <div className="bg-gray-900 p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-100 font-mono">
                    <code>{snippet.code}</code>
                  </pre>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopy(snippet)}
                      className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {copied === snippet.id ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDownload(snippet)}
                      className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    
                    <button
                      onClick={() => handleShare(snippet)}
                      className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>

                  {onInsert && (
                    <button
                      onClick={() => onInsert(snippet.code)}
                      className="btn-primary text-sm"
                    >
                      Insert into Editor
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Example snippets data
export const exampleSnippets: CodeSnippet[] = [
  {
    id: 'snippet-1',
    title: 'Connect to MetaMask',
    description: 'Simple function to connect to MetaMask wallet',
    language: 'typescript',
    category: 'wallet',
    tags: ['web3', 'metamask', 'wallet'],
    productionReady: true,
    code: `async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }
  
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });
  
  return accounts[0];
}`
  },
  {
    id: 'snippet-2',
    title: 'ERC-20 Token Balance',
    description: 'Get ERC-20 token balance for an address',
    language: 'typescript',
    category: 'defi',
    tags: ['erc20', 'token', 'balance'],
    productionReady: true,
    code: `import { ethers } from 'ethers';

async function getTokenBalance(
  tokenAddress: string,
  accountAddress: string
): Promise<string> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const tokenABI = ['function balanceOf(address) view returns (uint256)'];
  const contract = new ethers.Contract(tokenAddress, tokenABI, provider);
  
  const balance = await contract.balanceOf(accountAddress);
  return ethers.formatUnits(balance, 18);
}`
  },
  {
    id: 'snippet-3',
    title: 'Sign Message',
    description: 'Sign a message with user\'s wallet',
    language: 'typescript',
    category: 'wallet',
    tags: ['signature', 'authentication'],
    productionReady: true,
    code: `async function signMessage(message: string): Promise<string> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(message);
  return signature;
}`
  },
  {
    id: 'snippet-4',
    title: 'Deploy Contract',
    description: 'Deploy a smart contract using ethers.js',
    language: 'typescript',
    category: 'contract',
    tags: ['deployment', 'contract'],
    productionReady: true,
    code: `async function deployContract(
  abi: any[],
  bytecode: string,
  ...args: any[]
): Promise<string> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  
  return await contract.getAddress();
}`
  },
  {
    id: 'snippet-5',
    title: 'Listen to Events',
    description: 'Listen to smart contract events',
    language: 'typescript',
    category: 'contract',
    tags: ['events', 'monitoring'],
    productionReady: true,
    code: `async function listenToTransferEvents(
  contractAddress: string,
  callback: (from: string, to: string, amount: bigint) => void
): Promise<void> {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const abi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  contract.on('Transfer', (from, to, amount) => {
    callback(from, to, amount);
  });
}`
  }
];
