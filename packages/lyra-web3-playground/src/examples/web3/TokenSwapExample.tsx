/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Make it work, make it right, make it beautiful ✨
 */

import { useState } from 'react';
import { ArrowDownUp, AlertCircle, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';

// Simplified token swap example (demo mode - would need actual DEX integration)
export default function TokenSwapExample() {
  const { isConnected } = useWalletStore();
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState('0.5');

  const tokens = ['ETH', 'USDC', 'DAI', 'USDT', 'WBTC'];

  // Simulated exchange rates (in real app, fetch from DEX)
  const exchangeRates: Record<string, Record<string, number>> = {
    'ETH': { 'USDC': 2000, 'DAI': 2000, 'USDT': 2000, 'WBTC': 0.05 },
    'USDC': { 'ETH': 0.0005, 'DAI': 1, 'USDT': 1, 'WBTC': 0.000025 },
    'DAI': { 'ETH': 0.0005, 'USDC': 1, 'USDT': 1, 'WBTC': 0.000025 },
    'USDT': { 'ETH': 0.0005, 'USDC': 1, 'DAI': 1, 'WBTC': 0.000025 },
    'WBTC': { 'ETH': 20, 'USDC': 40000, 'DAI': 40000, 'USDT': 40000 },
  };

  const calculateOutput = (amount: string, from: string, to: string) => {
    if (!amount || from === to) return '';
    const rate = exchangeRates[from]?.[to];
    if (!rate) {
      setError(`No exchange rate available for ${from} to ${to}`);
      return '';
    }
    const output = parseFloat(amount) * rate;
    return output.toFixed(6);
  };

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    setToAmount(calculateOutput(value, fromToken, toToken));
  };

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    if (fromAmount) {
      const newToAmount = calculateOutput(fromAmount, toToken, tempToken);
      setToAmount(newToAmount);
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !window.ethereum) {
      setError('Please connect your wallet first');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsSwapping(true);
    setError(null);

    try {
      // In a real implementation, this would:
      // 1. Approve token spending (if not ETH)
      // 2. Call DEX router contract (Uniswap, etc.)
      // 3. Execute the swap transaction

      // Simulated delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Success notification
      setError(null);
      const successMsg = `Swap simulated! In production, this would swap ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`;
      
      // Show success state
      alert(successMsg); // TODO: Replace with toast notification in production
      
      setFromAmount('');
      setToAmount('');
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Failed to execute swap');
    } finally {
      setIsSwapping(false);
    }
  };

  const priceImpact = fromAmount && parseFloat(fromAmount) > 1000 ? '2.5%' : '0.1%';
  const minimumReceived = toAmount ? (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6) : '0';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Token Swap</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Swap tokens using decentralized exchanges (Demo Mode)
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="card">
        {/* Settings */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Swap</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Slippage:</span>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-16 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              step="0.1"
              min="0.1"
              max="5"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
          </div>
        </div>

        {/* From Token */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">From</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Balance: --
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold focus:outline-none"
                step="any"
              />
              <select
                value={fromToken}
                onChange={(e) => {
                  setFromToken(e.target.value);
                  if (fromAmount) {
                    setToAmount(calculateOutput(fromAmount, e.target.value, toToken));
                  }
                }}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold"
              >
                {tokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwapTokens}
              className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowDownUp className="w-5 h-5" />
            </button>
          </div>

          {/* To Token */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">To</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Balance: --
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold focus:outline-none"
              />
              <select
                value={toToken}
                onChange={(e) => {
                  setToToken(e.target.value);
                  if (fromAmount) {
                    setToAmount(calculateOutput(fromAmount, fromToken, e.target.value));
                  }
                }}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold"
              >
                {tokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        {fromAmount && toAmount && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Rate</span>
              <span className="font-medium">1 {fromToken} = {calculateOutput('1', fromToken, toToken)} {toToken}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Price Impact</span>
              <span className="font-medium text-green-600 dark:text-green-400">{priceImpact}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Minimum Received</span>
              <span className="font-medium">{minimumReceived} {toToken}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Network Fee</span>
              <span className="font-medium">~$2.50</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!isConnected || isSwapping || !fromAmount || parseFloat(fromAmount) <= 0}
          className="w-full mt-6 btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!isConnected ? (
            'Connect Wallet'
          ) : isSwapping ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Swapping...
            </span>
          ) : (
            'Swap'
          )}
        </button>
      </div>

      {/* Info Section */}
      <div className="mt-8 card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-3">How It Works</h3>
        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-primary-600">1.</span>
            <span>Select the tokens you want to swap and enter the amount</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-primary-600">2.</span>
            <span>Review the exchange rate, price impact, and fees</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-primary-600">3.</span>
            <span>Adjust slippage tolerance if needed (default 0.5%)</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-primary-600">4.</span>
            <span>Click "Swap" to execute the transaction</span>
          </li>
        </ol>
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Demo Mode:</strong> This is a demonstration interface. In production, this would integrate with Uniswap, 
            Sushiswap, or other DEX aggregators to execute real swaps.
          </p>
        </div>
      </div>
    </div>
  );
}
