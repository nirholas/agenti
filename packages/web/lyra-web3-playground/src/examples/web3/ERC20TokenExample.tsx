/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Code is poetry written for machines 📝
 */

import { useState } from 'react';
import { Coins } from 'lucide-react';

interface TokenInfo {
  symbol: string;
  name: string;
  totalSupply: number;
  decimals: number;
  yourBalance: number;
}

export default function ERC20TokenExample() {
  const [tokenInfo] = useState<TokenInfo>({
    symbol: 'DEMO',
    name: 'Demo Token',
    totalSupply: 1000000,
    decimals: 18,
    yourBalance: 1000,
  });

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState<{ from: string; to: string; amount: number; timestamp: number }[]>([]);

  const userAddress = '0x1234...5678';

  const handleTransfer = () => {
    if (!recipient || !amount || parseFloat(amount) <= 0) {
      alert('Please enter valid recipient and amount');
      return;
    }

    if (parseFloat(amount) > tokenInfo.yourBalance) {
      alert('Insufficient balance');
      return;
    }

    const newTx = {
      from: userAddress,
      to: recipient,
      amount: parseFloat(amount),
      timestamp: Date.now(),
    };

    setTransactions([newTx, ...transactions]);
    setRecipient('');
    setAmount('');
    alert(`Successfully transferred ${amount} ${tokenInfo.symbol} to ${recipient}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ERC-20 Token</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Fungible token standard for cryptocurrencies
        </p>
      </div>

      {/* Token Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Token Information</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Name:</span>
              <span className="font-semibold">{tokenInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Symbol:</span>
              <span className="font-semibold">{tokenInfo.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Decimals:</span>
              <span className="font-semibold">{tokenInfo.decimals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Total Supply:</span>
              <span className="font-semibold">{tokenInfo.totalSupply.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Balance</span>
            <Coins className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold">{tokenInfo.yourBalance.toLocaleString()} {tokenInfo.symbol}</p>
        </div>
      </div>

      {/* Transfer Section */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Transfer Tokens</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Address</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
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
            <p className="text-xs text-gray-500 mt-1">
              Available: {tokenInfo.yourBalance} {tokenInfo.symbol}
            </p>
          </div>

          <button onClick={handleTransfer} className="w-full btn-primary">
            Transfer
          </button>
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
          <div className="space-y-2">
            {transactions.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tx.from} → {tx.to}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
                <span className="font-semibold">{tx.amount} {tokenInfo.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Contract Code Preview */}
      <div className="card mt-8">
        <h2 className="text-xl font-bold mb-4">Sample ERC-20 Contract</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20Token {
    string public name = "Demo Token";
    string public symbol = "DEMO";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(balanceOf[msg.sender] >= _value);
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
    
    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }
    
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require(_value <= balanceOf[_from]);
        require(_value <= allowance[_from][msg.sender]);
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}`}
        </pre>
      </div>

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This demonstrates the ERC-20 token standard used by most cryptocurrencies on Ethereum. 
          The standard defines transfer, approve, and transferFrom functions for token transfers and allowances.
        </p>
      </div>
    </div>
  );
}
