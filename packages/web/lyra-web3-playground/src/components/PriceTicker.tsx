/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 You're doing incredible things 🎯
 */

/**
 * Live Price Ticker Component
 * Shows real-time crypto prices with auto-refresh
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useLivePrices } from '../hooks/useMarketData';

// Default coins to track
const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'bnb'];

interface PriceTickerProps {
  coins?: string[];
  refreshInterval?: number;
  showChange?: boolean;
  compact?: boolean;
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COIN_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  bitcoin: { symbol: '₿', color: 'text-orange-400' },
  ethereum: { symbol: 'Ξ', color: 'text-purple-400' },
  solana: { symbol: '◎', color: 'text-gradient-to-r from-purple-500 to-cyan-500' },
  bnb: { symbol: 'BNB', color: 'text-yellow-400' },
  cardano: { symbol: 'ADA', color: 'text-blue-400' },
  polkadot: { symbol: 'DOT', color: 'text-pink-400' },
  avalanche: { symbol: 'AVAX', color: 'text-red-400' },
  polygon: { symbol: 'MATIC', color: 'text-purple-500' },
};

export default function PriceTicker({
  coins = DEFAULT_COINS,
  refreshInterval = 30000,
  showChange = true,
  compact = false,
}: PriceTickerProps) {
  const { data, loading, error } = useLivePrices(coins, refreshInterval);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-4 text-sm animate-pulse">
        {coins.map((coin) => (
          <div key={coin} className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700 rounded-full"></div>
            <div className="w-16 h-4 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return null; // Fail silently - don't break UI if API is down
  }

  return (
    <Link to="/markets" className="group">
      <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'} text-sm`}>
        {coins.map((coin) => {
          const priceData = data[coin];
          if (!priceData) return null;
          
          const coinInfo = COIN_SYMBOLS[coin] || { symbol: coin.charAt(0).toUpperCase(), color: 'text-gray-400' };
          const isPositive = priceData.usd_24h_change >= 0;
          
          return (
            <div
              key={coin}
              className={`flex items-center gap-2 ${compact ? 'gap-1' : 'gap-2'} group-hover:opacity-75 transition-opacity`}
            >
              <span className={coinInfo.color}>{coinInfo.symbol}</span>
              <span className="text-white font-medium">{formatPrice(priceData.usd)}</span>
              {showChange && (
                <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{priceData.usd_24h_change.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Link>
  );
}

// Mini version for mobile/compact displays
export function MiniPriceTicker() {
  const { data, loading } = useLivePrices(['bitcoin', 'ethereum'], 30000);

  if (loading || !data) return null;

  const btc = data.bitcoin;
  const eth = data.ethereum;

  return (
    <Link to="/markets" className="flex items-center gap-3 text-xs">
      {btc && (
        <span className="flex items-center gap-1">
          <span className="text-orange-400">₿</span>
          <span className="text-white">{formatPrice(btc.usd)}</span>
        </span>
      )}
      {eth && (
        <span className="flex items-center gap-1">
          <span className="text-purple-400">Ξ</span>
          <span className="text-white">{formatPrice(eth.usd)}</span>
        </span>
      )}
    </Link>
  );
}
