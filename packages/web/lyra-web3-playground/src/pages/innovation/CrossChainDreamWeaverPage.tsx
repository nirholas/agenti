/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Cross-Chain Dream Weaver Standalone Page
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, Sparkles } from 'lucide-react';
import CrossChainDreamWeaver from '@/components/Innovation/CrossChainDreamWeaver';

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Cross-Chain Ready Token
/// @notice A token designed for multi-chain deployment
contract CrossChainToken {
    string public name = "CrossToken";
    string public symbol = "CROSS";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Cross-chain bridge address (set per chain)
    address public bridge;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event CrossChainTransfer(uint256 indexed destChainId, address indexed to, uint256 amount);
    
    constructor(uint256 initialSupply) {
        totalSupply = initialSupply * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /// @notice Initiate cross-chain transfer
    function bridgeTransfer(uint256 destChainId, address to, uint256 amount) external {
        require(bridge != address(0), "Bridge not set");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        
        emit CrossChainTransfer(destChainId, to, amount);
    }
    
    function setBridge(address _bridge) external {
        require(bridge == address(0), "Bridge already set");
        bridge = _bridge;
    }
}`;

export default function CrossChainDreamWeaverPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const handleLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link 
            to="/innovation" 
            className="inline-flex items-center gap-2 text-emerald-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Innovation Hub
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Globe className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                Cross-Chain Dream Weaver
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </h1>
              <p className="text-emerald-200 mt-1">
                Deploy to 8+ blockchains with one click and smart AI optimization
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Cross-Chain Contract</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Deploy this contract across multiple chains</p>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Cross-Chain Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <CrossChainDreamWeaver 
              code={code}
              onLog={handleLog}
            />
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Deployment Log</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {logs.slice(-10).reverse().map((log, i) => (
                <div 
                  key={i}
                  className={`text-sm px-3 py-2 rounded ${
                    log.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    log.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                    log.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supported Chains */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Supported Chains</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">⟠</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Ethereum</div>
                <div className="text-xs text-gray-500">Chain ID: 1</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">⬢</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Polygon</div>
                <div className="text-xs text-gray-500">Chain ID: 137</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">◆</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">BSC</div>
                <div className="text-xs text-gray-500">Chain ID: 56</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">◉</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Arbitrum</div>
                <div className="text-xs text-gray-500">Chain ID: 42161</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">⬡</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Optimism</div>
                <div className="text-xs text-gray-500">Chain ID: 10</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">❄️</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Avalanche</div>
                <div className="text-xs text-gray-500">Chain ID: 43114</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">🔷</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Base</div>
                <div className="text-xs text-gray-500">Chain ID: 8453</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">zkSync</div>
                <div className="text-xs text-gray-500">Chain ID: 324</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
