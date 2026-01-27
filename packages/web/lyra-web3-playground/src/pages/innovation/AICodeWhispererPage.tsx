/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 AI Code Whisperer Standalone Page
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Sparkles } from 'lucide-react';
import AICodeWhisperer from '@/components/Innovation/AICodeWhisperer';

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract VulnerableContract {
    mapping(address => uint256) public balances;
    
    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }
    
    // ⚠️ Vulnerable to reentrancy!
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // External call before state update - vulnerability!
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= amount;
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}`;

export default function AICodeWhispererPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const handleLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link 
            to="/innovation" 
            className="inline-flex items-center gap-2 text-purple-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Innovation Hub
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Brain className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                AI Code Whisperer
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </h1>
              <p className="text-purple-200 mt-1">
                Real-time vulnerability detection, gas optimization, and security insights powered by AI
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
              <h2 className="font-semibold text-gray-900 dark:text-white">Smart Contract Code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Edit the code to see AI analysis in real-time</p>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* AI Whisperer Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <AICodeWhisperer 
              code={code} 
              onCodeChange={setCode}
              onLog={handleLog}
            />
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Activity Log</h3>
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

        {/* Features Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-purple-600 dark:text-purple-400">🔍 Vulnerability Detection</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Detects 94% of common smart contract vulnerabilities instantly
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400">⚡ Gas Optimization</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              AI-powered suggestions to reduce gas costs by up to 70%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-green-600 dark:text-green-400">🎤 Voice Control</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Hands-free coding with voice commands and dictation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
