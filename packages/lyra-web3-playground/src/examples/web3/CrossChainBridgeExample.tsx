/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Believe in your code, believe in yourself 💪
 */

import { useState } from 'react';
import { Layers, ArrowRightLeft, Clock, CheckCircle } from 'lucide-react';

interface Bridge {
  name: string;
  fromChain: string;
  toChain: string;
  supportedTokens: string[];
  fee: number;
  estimatedTime: string;
}

export default function CrossChainBridgeExample() {
  const bridges: Bridge[] = [
    { name: 'Ethereum ↔ Polygon', fromChain: 'Ethereum', toChain: 'Polygon', supportedTokens: ['ETH', 'USDC', 'DAI'], fee: 0.001, estimatedTime: '7-10 min' },
    { name: 'Ethereum ↔ Arbitrum', fromChain: 'Ethereum', toChain: 'Arbitrum', supportedTokens: ['ETH', 'USDC', 'USDT'], fee: 0.0005, estimatedTime: '10-15 min' },
    { name: 'Ethereum ↔ Optimism', fromChain: 'Ethereum', toChain: 'Optimism', supportedTokens: ['ETH', 'DAI', 'USDT'], fee: 0.0008, estimatedTime: '10-15 min' },
  ];

  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null);
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [transfers, setTransfers] = useState<any[]>([]);

  const handleBridge = () => {
    if (!selectedBridge || !selectedToken || !amount) {
      alert('Please fill all fields');
      return;
    }

    const transfer = {
      id: Date.now(),
      bridge: selectedBridge.name,
      token: selectedToken,
      amount: parseFloat(amount),
      status: 'pending',
      timestamp: Date.now(),
    };

    setTransfers([transfer, ...transfers]);
    setAmount('');

    // Simulate completion after 5 seconds
    setTimeout(() => {
      setTransfers(prev => prev.map(t => 
        t.id === transfer.id ? { ...t, status: 'completed' } : t
      ));
    }, 5000);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cross-Chain Bridge</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Transfer assets between different blockchain networks
        </p>
      </div>

      {/* Available Bridges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {bridges.map((bridge, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedBridge(bridge)}
            className={`card cursor-pointer transition-all ${
              selectedBridge?.name === bridge.name
                ? 'border-primary-500 ring-2 ring-primary-500'
                : 'hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Layers className="w-5 h-5 text-blue-600" />
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                {bridge.estimatedTime}
              </span>
            </div>
            <h3 className="font-bold mb-2">{bridge.name}</h3>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p>Fee: {bridge.fee} ETH</p>
              <p>Tokens: {bridge.supportedTokens.join(', ')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bridge Interface */}
      {selectedBridge && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Bridge Tokens</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Token</label>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="">Choose a token</option>
                {selectedBridge.supportedTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>Bridge Fee:</span>
                <span className="font-semibold">{selectedBridge.fee} ETH</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated Time:</span>
                <span className="font-semibold">{selectedBridge.estimatedTime}</span>
              </div>
            </div>

            <button
              onClick={handleBridge}
              disabled={!selectedToken || !amount}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Bridge Tokens
            </button>
          </div>
        </div>
      )}

      {/* Transfer History */}
      {transfers.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Transfers</h2>
          <div className="space-y-3">
            {transfers.map(transfer => (
              <div key={transfer.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold">{transfer.amount} {transfer.token}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{transfer.bridge}</p>
                </div>
                <div className="flex items-center gap-2">
                  {transfer.status === 'pending' ? (
                    <>
                      <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
                      <span className="text-sm text-yellow-600">Pending</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Completed</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This demonstrates cross-chain bridges that allow asset transfers between different blockchains. 
          Popular bridges include Polygon Bridge, Arbitrum Bridge, and Optimism Gateway.
        </p>
      </div>
    </div>
  );
}
