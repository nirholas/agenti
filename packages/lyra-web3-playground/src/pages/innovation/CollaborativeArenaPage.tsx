/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Collaborative Arena Standalone Page
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Sparkles } from 'lucide-react';
import CollaborativeArena from '@/components/Innovation/CollaborativeArena';

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Collaborative Challenge Contract
/// @notice Complete the functions to pass all test cases!
contract CollaborativeChallenge {
    mapping(address => uint256) public scores;
    address[] public leaderboard;
    
    event ScoreUpdated(address indexed player, uint256 newScore);
    event ChallengeCompleted(address indexed winner, uint256 reward);
    
    /// @notice TODO: Implement a secure deposit function
    function deposit() external payable {
        // Your code here...
    }
    
    /// @notice TODO: Implement score tracking with overflow protection
    function addScore(address player, uint256 points) external {
        // Your code here...
    }
    
    /// @notice TODO: Return top 3 players
    function getTopPlayers() external view returns (address[] memory) {
        // Your code here...
    }
    
    /// @notice TODO: Implement secure reward distribution
    function distributeReward(address winner) external {
        // Your code here...
    }
}`;

export default function CollaborativeArenaPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<Array<{ type: string; message: string; timestamp: number }>>([]);

  const handleLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link 
            to="/innovation" 
            className="inline-flex items-center gap-2 text-violet-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Innovation Hub
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                Collaborative Arena
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </h1>
              <p className="text-violet-200 mt-1">
                Code with AI teammates, compete in challenges, and earn bounties
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
              <h2 className="font-semibold text-gray-900 dark:text-white">Challenge Code</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Complete the TODOs with help from AI teammates</p>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Arena Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <CollaborativeArena 
              code={code}
              onCodeChange={setCode}
              onLog={handleLog}
            />
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Arena Log</h3>
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

        {/* AI Teammates */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-violet-600 dark:text-violet-400">🤖 CodePilot</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Your AI pair programmer that suggests completions and fixes
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-fuchsia-600 dark:text-fuchsia-400">👨‍🏫 Professor AI</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Explains concepts and provides educational guidance
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <h3 className="font-semibold text-pink-600 dark:text-pink-400">🛡️ Security Auditor</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Reviews your code for vulnerabilities and best practices
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
