/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The web is your canvas, code is your brush ��️
 */

import { useState } from 'react';
import { Shield, Users, CheckCircle, XCircle, Clock, Send } from 'lucide-react';

interface Transaction {
  id: number;
  to: string;
  value: number;
  description: string;
  approvals: string[];
  executed: boolean;
  timestamp: number;
}

export default function MultiSigWalletExample() {
  const owners = [
    '0x1111...1111',
    '0x2222...2222',
    '0x3333...3333',
  ];
  
  const [currentUser] = useState('0x1111...1111');
  const [requiredApprovals] = useState(2);
  const [balance] = useState(10.5);
  
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      to: '0xaaaa...bbbb',
      value: 2.5,
      description: 'Payment for development services',
      approvals: ['0x1111...1111'],
      executed: false,
      timestamp: Date.now() - 3600000,
    },
    {
      id: 2,
      to: '0xcccc...dddd',
      value: 0.5,
      description: 'Domain renewal payment',
      approvals: ['0x1111...1111', '0x2222...2222'],
      executed: false,
      timestamp: Date.now() - 7200000,
    },
  ]);

  const [newTx, setNewTx] = useState({ to: '', value: '', description: '' });

  const handleSubmitTransaction = () => {
    if (!newTx.to || !newTx.value || !newTx.description) {
      alert('Please fill all fields');
      return;
    }

    const transaction: Transaction = {
      id: transactions.length + 1,
      to: newTx.to,
      value: parseFloat(newTx.value),
      description: newTx.description,
      approvals: [currentUser],
      executed: false,
      timestamp: Date.now(),
    };

    setTransactions([...transactions, transaction]);
    setNewTx({ to: '', value: '', description: '' });
  };

  const handleApprove = (txId: number) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === txId && !tx.approvals.includes(currentUser)) {
        return { ...tx, approvals: [...tx.approvals, currentUser] };
      }
      return tx;
    }));
  };

  const handleRevoke = (txId: number) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === txId) {
        return { ...tx, approvals: tx.approvals.filter(a => a !== currentUser) };
      }
      return tx;
    }));
  };

  const handleExecute = (txId: number) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx || tx.approvals.length < requiredApprovals) {
      alert('Not enough approvals to execute transaction');
      return;
    }

    setTransactions(transactions.map(t => 
      t.id === txId ? { ...t, executed: true } : t
    ));
  };

  const pendingTransactions = transactions.filter(tx => !tx.executed);
  const executedTransactions = transactions.filter(tx => tx.executed);

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Multi-Signature Wallet</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Secure wallet requiring multiple approvals for transactions
        </p>
      </div>

      {/* Wallet Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Wallet Balance</span>
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{balance} ETH</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Owners</span>
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{owners.length}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Required Approvals</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">{requiredApprovals} / {owners.length}</p>
        </div>
      </div>

      {/* Submit New Transaction */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Submit New Transaction</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Address</label>
            <input
              type="text"
              value={newTx.to}
              onChange={(e) => setNewTx({ ...newTx, to: e.target.value })}
              placeholder="0x..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (ETH)</label>
            <input
              type="number"
              value={newTx.value}
              onChange={(e) => setNewTx({ ...newTx, value: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input
              type="text"
              value={newTx.description}
              onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
              placeholder="Payment purpose"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <button
            onClick={handleSubmitTransaction}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit Transaction
          </button>
        </div>
      </div>

      {/* Pending Transactions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Pending Transactions</h2>
        
        {pendingTransactions.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No pending transactions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTransactions.map(tx => {
              const hasApproved = tx.approvals.includes(currentUser);
              const canExecute = tx.approvals.length >= requiredApprovals;

              return (
                <div key={tx.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold mb-1">{tx.description}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        To: <span className="font-mono text-xs">{tx.to}</span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Amount: <span className="font-semibold">{tx.value} ETH</span>
                      </p>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {getTimeAgo(tx.timestamp)}
                    </div>
                  </div>

                  {/* Approval Status */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Approvals</span>
                      <span className="text-sm font-bold">
                        {tx.approvals.length} / {requiredApprovals}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {owners.map(owner => {
                        const hasApproved = tx.approvals.includes(owner);
                        return (
                          <div key={owner} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs">{owner}</span>
                            {hasApproved ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!hasApproved ? (
                      <button
                        onClick={() => handleApprove(tx.id)}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRevoke(tx.id)}
                        className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      >
                        Revoke Approval
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleExecute(tx.id)}
                      disabled={!canExecute}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      Execute
                    </button>
                  </div>
                  
                  {canExecute && (
                    <p className="text-xs text-green-600 dark:text-green-400 text-center mt-2">
                      ✓ Ready to execute
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      {executedTransactions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Transaction History</h2>
          <div className="space-y-2">
            {executedTransactions.map(tx => (
              <div key={tx.id} className="card bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {tx.value} ETH → {tx.to}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{getTimeAgo(tx.timestamp)}</span>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This is a simulation of multi-signature wallets like Gnosis Safe. 
          In production, transactions would require multiple on-chain signatures before execution, providing enhanced security for shared funds.
        </p>
      </div>
    </div>
  );
}
