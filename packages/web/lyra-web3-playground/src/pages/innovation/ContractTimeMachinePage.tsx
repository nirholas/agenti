/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Contract Time Machine Standalone Page
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles } from 'lucide-react';
import ContractTimeMachine from '@/components/Innovation/ContractTimeMachine';

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EvolvingToken {
    string public name = "TimeToken";
    string public symbol = "TIME";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
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
}`;

export default function ContractTimeMachinePage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const handleLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link 
            to="/innovation" 
            className="inline-flex items-center gap-2 text-indigo-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Innovation Hub
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                Contract Time Machine
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </h1>
              <p className="text-indigo-200 mt-1">
                Travel through code history, fork realities, and simulate future executions
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Make changes and travel through time</p>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Time Machine Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <ContractTimeMachine 
              currentCode={code} 
              onCodeChange={setCode}
              onLog={handleLog}
            />
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Timeline Log</h3>
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
            <h3 className="font-semibold text-indigo-600 dark:text-indigo-400">⏪ Time Travel</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Navigate through every version of your code with precision
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-purple-600 dark:text-purple-400">🔀 Fork Reality</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create parallel timelines to explore different implementations
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400">🔮 Future Simulation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Predict how your contract will behave under various conditions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
