/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Turning ideas into reality, one function at a time 💭
 */

import { useState } from 'react';
import { Sparkles, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';

export default function AIContractGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Example templates for demo
  const templates = {
    'ERC20 Token': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`,
    'NFT Collection': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    uint256 public maxSupply = 10000;
    uint256 public mintPrice = 0.01 ether;

    constructor() ERC721("MyNFT", "MNFT") {}

    function mint() public payable {
        require(_tokenIds.current() < maxSupply, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(msg.sender, newItemId);
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}`,
    'Simple Escrow': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleEscrow {
    address public buyer;
    address public seller;
    address public arbiter;
    uint256 public amount;
    bool public isReleased;
    bool public isRefunded;

    constructor(address _seller, address _arbiter) payable {
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        amount = msg.value;
    }

    function releaseFunds() public {
        require(msg.sender == buyer || msg.sender == arbiter, "Unauthorized");
        require(!isReleased && !isRefunded, "Already processed");
        
        isReleased = true;
        payable(seller).transfer(amount);
    }

    function refund() public {
        require(msg.sender == seller || msg.sender == arbiter, "Unauthorized");
        require(!isReleased && !isRefunded, "Already processed");
        
        isRefunded = true;
        payable(buyer).transfer(amount);
    }
}`
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what contract you want to generate');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedCode('');

    try {
      // Simulate AI generation with delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simple keyword matching for demo (in production, use OpenAI/Claude)
      let selectedTemplate = templates['ERC20 Token'];
      const lowerPrompt = prompt.toLowerCase();
      
      if (lowerPrompt.includes('nft') || lowerPrompt.includes('721') || lowerPrompt.includes('collectible')) {
        selectedTemplate = templates['NFT Collection'];
      } else if (lowerPrompt.includes('escrow') || lowerPrompt.includes('payment')) {
        selectedTemplate = templates['Simple Escrow'];
      }

      // Add a comment with the prompt (sanitized)
      const sanitizedPrompt = prompt.replace(/[^\w\s.,!?-]/g, '').substring(0, 200);
      const codeWithPrompt = `// Generated from prompt: "${sanitizedPrompt}"\n\n${selectedTemplate}`;
      setGeneratedCode(codeWithPrompt);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate contract');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(generatedCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const examplePrompts = [
    'Create an ERC20 token with minting functionality',
    'Build an NFT collection with max supply and minting price',
    'Make a simple escrow contract for payments',
    'Create a basic voting contract for DAO governance',
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Sparkles className="w-8 h-8 mr-3 text-primary-600" />
          AI Contract Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Describe your smart contract in natural language and let AI generate the code
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Describe Your Contract</h2>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: Create an ERC20 token with 1 million initial supply..."
            className="w-full h-40 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full mt-4 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Contract'}
          </button>

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Example Prompts:
            </p>
            <div className="space-y-2">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  className="w-full text-left p-2 text-sm bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Generated Contract</h2>
            {generatedCode && (
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-sm text-primary-600 hover:text-primary-700"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          {generatedCode ? (
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-sm text-gray-100 font-mono">
                <code>{generatedCode}</code>
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                {isGenerating ? 'Generating your contract...' : 'Your generated contract will appear here'}
              </p>
            </div>
          )}

          {generatedCode && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-800 dark:text-green-200">
                ✓ Contract generated successfully! Review the code carefully before deployment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-3">AI-Powered Features</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start space-x-2">
            <span className="text-primary-600">•</span>
            <span><strong>Natural Language:</strong> Describe contracts in plain English</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-primary-600">•</span>
            <span><strong>Best Practices:</strong> Generated code follows OpenZeppelin standards</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-primary-600">•</span>
            <span><strong>Security:</strong> AI suggests secure patterns and prevents common vulnerabilities</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-primary-600">•</span>
            <span><strong>Customizable:</strong> Edit generated code to fit your specific needs</span>
          </li>
        </ul>
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Demo Mode:</strong> This uses template matching. In production, integrate with OpenAI GPT-4, 
            Anthropic Claude, or fine-tuned models for real AI-powered generation.
          </p>
        </div>
      </div>
    </div>
  );
}
