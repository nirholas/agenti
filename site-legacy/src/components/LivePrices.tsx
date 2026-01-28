'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
  market_cap: number;
  total_volume: number;
}

const TRACKED_COINS = ['bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'cardano', 'avalanche-2', 'polkadot', 'chainlink', 'polygon'];

export default function LivePrices() {
  const [prices, setPrices] = useState<CoinPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrices = async () => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${TRACKED_COINS.join(',')}&order=market_cap_desc&sparkline=false`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      setPrices(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Unable to fetch live prices');
      console.error('Price fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  };

  const formatMarketCap = (cap: number) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
    return `$${cap.toLocaleString()}`;
  };

  if (loading) {
    return (
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span className="text-ghost text-sm">Loading live prices...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-ghost">{error}</p>
          <button 
            onClick={fetchPrices}
            className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-glass mb-1">Live Prices</h2>
            <p className="text-sm text-ghost">Real-time data from CoinGecko</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-ghost">
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Live'}
            </span>
          </div>
        </div>

        {/* Price Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AnimatePresence mode="popLayout">
            {prices.map((coin, i) => (
              <motion.div
                key={coin.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="glass-panel p-4 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img 
                    src={coin.image} 
                    alt={coin.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-glass truncate">{coin.symbol.toUpperCase()}</div>
                    <div className="text-xs text-ghost truncate">{coin.name}</div>
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div className="text-lg font-semibold text-glass">
                    {formatPrice(coin.current_price)}
                  </div>
                  <div className={`text-sm font-medium ${
                    coin.price_change_percentage_24h >= 0 
                      ? 'text-emerald-400' 
                      : 'text-red-400'
                  }`}>
                    {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                    {coin.price_change_percentage_24h.toFixed(2)}%
                  </div>
                </div>

                {/* Market cap on hover */}
                <div className="mt-2 pt-2 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-between text-xs">
                    <span className="text-ghost">MCap</span>
                    <span className="text-whisper">{formatMarketCap(coin.market_cap)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Powered by */}
        <div className="mt-6 text-center">
          <span className="text-xs text-ghost/50">
            Powered by CoinGecko API • Updates every 30s
          </span>
        </div>
      </div>
    </section>
  );
}
