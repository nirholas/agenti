/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Let your code tell a story 📖
 */

import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, DollarSign } from 'lucide-react';

export default function DeFiLendingExample() {
  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ETH');
  const [deposits, setDeposits] = useState<{ [key: string]: number }>({});
  const [borrows, setBorrows] = useState<{ [key: string]: number }>({});

  const assets = [
    { symbol: 'ETH', apy: 3.5, borrowRate: 4.5, price: 2000 },
    { symbol: 'USDC', apy: 5.2, borrowRate: 6.8, price: 1 },
    { symbol: 'DAI', apy: 4.8, borrowRate: 6.2, price: 1 },
    { symbol: 'WBTC', apy: 2.8, borrowRate: 3.9, price: 42000 },
  ];

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    
    const newDeposits = { ...deposits };
    newDeposits[selectedAsset] = (newDeposits[selectedAsset] || 0) + parseFloat(depositAmount);
    setDeposits(newDeposits);
    setDepositAmount('');
  };

  const handleBorrow = () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) return;
    
    const collateralValue = calculateTotalCollateral();
    const borrowValue = calculateTotalBorrow() + (parseFloat(borrowAmount) * getCurrentPrice());
    
    if (borrowValue > collateralValue * 0.75) {
      alert('Insufficient collateral! You can borrow up to 75% of your collateral value.');
      return;
    }
    
    const newBorrows = { ...borrows };
    newBorrows[selectedAsset] = (newBorrows[selectedAsset] || 0) + parseFloat(borrowAmount);
    setBorrows(newBorrows);
    setBorrowAmount('');
  };

  const getCurrentPrice = () => {
    return assets.find(a => a.symbol === selectedAsset)?.price || 1;
  };

  const calculateTotalCollateral = () => {
    return Object.entries(deposits).reduce((total, [symbol, amount]) => {
      const price = assets.find(a => a.symbol === symbol)?.price || 1;
      return total + (amount * price);
    }, 0);
  };

  const calculateTotalBorrow = () => {
    return Object.entries(borrows).reduce((total, [symbol, amount]) => {
      const price = assets.find(a => a.symbol === symbol)?.price || 1;
      return total + (amount * price);
    }, 0);
  };

  const collateralValue = calculateTotalCollateral();
  const borrowValue = calculateTotalBorrow();
  const healthFactor = borrowValue > 0 ? (collateralValue * 0.75) / borrowValue : Infinity;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DeFi Lending Protocol</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Deposit assets to earn interest and borrow against your collateral
        </p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Deposited</span>
            <ArrowDownCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">${collateralValue.toFixed(2)}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Borrowed</span>
            <ArrowUpCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold">${borrowValue.toFixed(2)}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Health Factor</span>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-2xl font-bold ${
            healthFactor < 1.2 ? 'text-red-600' : 
            healthFactor < 1.5 ? 'text-yellow-600' : 
            'text-green-600'
          }`}>
            {healthFactor === Infinity ? '∞' : healthFactor.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deposit Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <ArrowDownCircle className="w-5 h-5 mr-2 text-green-600" />
            Deposit & Earn
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              {assets.map(asset => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.symbol} - {asset.apy}% APY
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <button
            onClick={handleDeposit}
            className="w-full btn-primary"
          >
            Deposit
          </button>

          {Object.keys(deposits).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium mb-2">Your Deposits:</p>
              {Object.entries(deposits).map(([symbol, amount]) => (
                <div key={symbol} className="flex justify-between text-sm py-1">
                  <span>{symbol}</span>
                  <span className="font-semibold">{amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Borrow Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <ArrowUpCircle className="w-5 h-5 mr-2 text-red-600" />
            Borrow
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Asset</label>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              {assets.map(asset => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.symbol} - {asset.borrowRate}% Rate
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available to borrow: ${(collateralValue * 0.75 - borrowValue).toFixed(2)}
            </p>
          </div>

          <button
            onClick={handleBorrow}
            disabled={collateralValue === 0}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Borrow
          </button>

          {Object.keys(borrows).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium mb-2">Your Borrows:</p>
              {Object.entries(borrows).map(([symbol, amount]) => (
                <div key={symbol} className="flex justify-between text-sm py-1">
                  <span>{symbol}</span>
                  <span className="font-semibold">{amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Market Info */}
      <div className="card mt-8">
        <h2 className="text-xl font-bold mb-4">Market Rates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2">Asset</th>
                <th className="text-right py-2">Deposit APY</th>
                <th className="text-right py-2">Borrow Rate</th>
                <th className="text-right py-2">Price</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <tr key={asset.symbol} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-medium">{asset.symbol}</td>
                  <td className="text-right text-green-600">{asset.apy}%</td>
                  <td className="text-right text-red-600">{asset.borrowRate}%</td>
                  <td className="text-right">${asset.price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This is a simulation of a DeFi lending protocol like Aave or Compound. 
          In production, this would interact with smart contracts on-chain for deposits, borrows, and interest accrual.
        </p>
      </div>
    </div>
  );
}
