/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every line of code is a step toward something amazing ✨
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useTopCoins,
  useTrending,
  useGlobalMarketData,
  useTopProtocols,
  useTopChains,
  useTopYields,
  useLivePrices,
} from '../hooks/useMarketData';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return 'N/A';
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(num: number | null | undefined): string {
  if (num === null || num === undefined) return 'N/A';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function PriceChange({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-gray-500">N/A</span>;
  const isPositive = value >= 0;
  return (
    <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
      {formatPercent(value)}
    </span>
  );
}

// ============================================================
// SPARKLINE COMPONENT
// ============================================================

function Sparkline({ data, color = '#22c55e' }: { data?: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const width = 100;
  const height = 30;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const lineColor = data[data.length - 1] >= data[0] ? '#22c55e' : '#ef4444';
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
      />
    </svg>
  );
}

// ============================================================
// TAB COMPONENTS
// ============================================================

type Tab = 'markets' | 'defi' | 'yields' | 'chains';

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-medium transition-colors ${
        active
          ? 'text-indigo-400 border-b-2 border-indigo-400'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================
// GLOBAL STATS BAR
// ============================================================

function GlobalStatsBar() {
  const { data, loading } = useGlobalMarketData();
  const livePrices = useLivePrices(['bitcoin', 'ethereum'], 30000);
  
  if (loading || !data) {
    return (
      <div className="bg-gray-800/50 border-b border-gray-700 p-3">
        <div className="max-w-7xl mx-auto flex gap-6 text-sm animate-pulse">
          <div className="h-4 w-32 bg-gray-700 rounded"></div>
          <div className="h-4 w-32 bg-gray-700 rounded"></div>
          <div className="h-4 w-24 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/50 border-b border-gray-700 p-3">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-4 md:gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Market Cap:</span>
          <span className="text-white font-medium">{formatNumber(data.total_market_cap?.usd)}</span>
          <PriceChange value={data.market_cap_change_percentage_24h_usd} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">24h Vol:</span>
          <span className="text-white font-medium">{formatNumber(data.total_volume?.usd)}</span>
        </div>
        {livePrices.data && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-orange-400">₿</span>
              <span className="text-white font-medium">{formatPrice(livePrices.data.bitcoin?.usd)}</span>
              <PriceChange value={livePrices.data.bitcoin?.usd_24h_change} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-400">Ξ</span>
              <span className="text-white font-medium">{formatPrice(livePrices.data.ethereum?.usd)}</span>
              <PriceChange value={livePrices.data.ethereum?.usd_24h_change} />
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Coins:</span>
          <span className="text-white font-medium">{data.active_cryptocurrencies?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MARKETS TAB
// ============================================================

function MarketsTab() {
  const { data: coins, loading, error } = useTopCoins(50);
  const { data: trending } = useTrending();
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load market data</p>
        <p className="text-gray-500 text-sm mt-2">{error.message}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Trending Section */}
      {trending && trending.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            🔥 Trending
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {trending.slice(0, 7).map((coin) => (
              <div
                key={coin.id}
                className="flex-shrink-0 bg-gray-800 rounded-lg p-3 flex items-center gap-3"
              >
                <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full" />
                <div>
                  <span className="text-white font-medium">{coin.symbol.toUpperCase()}</span>
                  <span className="text-gray-500 text-sm ml-2">#{coin.market_cap_rank}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Main Table */}
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-sm font-medium p-4">#</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">Coin</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4">Price</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden sm:table-cell">24h</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden md:table-cell">Market Cap</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden lg:table-cell">Volume (24h)</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden xl:table-cell">7d Chart</th>
            </tr>
          </thead>
          <tbody>
            {coins?.map((coin) => (
              <tr key={coin.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="p-4 text-gray-500">{coin.market_cap_rank}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {coin.image && (
                      <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <div className="text-white font-medium">{coin.name}</div>
                      <div className="text-gray-500 text-sm">{coin.symbol.toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right text-white font-medium">{formatPrice(coin.current_price)}</td>
                <td className="p-4 text-right hidden sm:table-cell">
                  <PriceChange value={coin.price_change_percentage_24h} />
                </td>
                <td className="p-4 text-right text-white hidden md:table-cell">{formatNumber(coin.market_cap)}</td>
                <td className="p-4 text-right text-gray-400 hidden lg:table-cell">{formatNumber(coin.total_volume)}</td>
                <td className="p-4 text-right hidden xl:table-cell">
                  <Sparkline data={coin.sparkline_in_7d?.price} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// DEFI TAB
// ============================================================

function DefiTab() {
  const { data: protocols, loading, error } = useTopProtocols(30);
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load DeFi data</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/50 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left text-gray-400 text-sm font-medium p-4">#</th>
            <th className="text-left text-gray-400 text-sm font-medium p-4">Protocol</th>
            <th className="text-left text-gray-400 text-sm font-medium p-4 hidden sm:table-cell">Category</th>
            <th className="text-right text-gray-400 text-sm font-medium p-4">TVL</th>
            <th className="text-right text-gray-400 text-sm font-medium p-4 hidden md:table-cell">1d Change</th>
            <th className="text-right text-gray-400 text-sm font-medium p-4 hidden lg:table-cell">7d Change</th>
          </tr>
        </thead>
        <tbody>
          {protocols?.map((protocol, index) => (
            <tr key={protocol.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
              <td className="p-4 text-gray-500">{index + 1}</td>
              <td className="p-4">
                <div className="flex items-center gap-3">
                  {protocol.logo && (
                    <img src={protocol.logo} alt={protocol.name} className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div className="text-white font-medium">{protocol.name}</div>
                    <div className="text-gray-500 text-sm">{protocol.chains?.slice(0, 3).join(', ')}</div>
                  </div>
                </div>
              </td>
              <td className="p-4 text-gray-400 hidden sm:table-cell">{protocol.category || 'N/A'}</td>
              <td className="p-4 text-right text-white font-medium">{formatNumber(protocol.tvl)}</td>
              <td className="p-4 text-right hidden md:table-cell">
                <PriceChange value={protocol.change_1d} />
              </td>
              <td className="p-4 text-right hidden lg:table-cell">
                <PriceChange value={protocol.change_7d} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// YIELDS TAB
// ============================================================

function YieldsTab() {
  const { data: yields, loading, error } = useTopYields(30);
  const [filter, setFilter] = useState<'all' | 'stablecoin'>('all');
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load yield data</p>
      </div>
    );
  }
  
  const filteredYields = filter === 'stablecoin' 
    ? yields?.filter(y => y.stablecoin)
    : yields;
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All Pools
        </button>
        <button
          onClick={() => setFilter('stablecoin')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'stablecoin' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Stablecoins Only
        </button>
      </div>
      
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-sm font-medium p-4">Pool</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4 hidden sm:table-cell">Project</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4 hidden md:table-cell">Chain</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4">APY</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden lg:table-cell">TVL</th>
            </tr>
          </thead>
          <tbody>
            {filteredYields?.map((pool) => (
              <tr key={pool.pool} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="p-4">
                  <div className="text-white font-medium">{pool.symbol}</div>
                  {pool.stablecoin && (
                    <span className="inline-block bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded mt-1">
                      Stable
                    </span>
                  )}
                </td>
                <td className="p-4 text-gray-400 hidden sm:table-cell">{pool.project}</td>
                <td className="p-4 hidden md:table-cell">
                  <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                    {pool.chain}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="text-green-400 font-semibold">{pool.apy?.toFixed(2)}%</span>
                  {pool.apyBase && pool.apyReward && (
                    <div className="text-gray-500 text-xs">
                      Base: {pool.apyBase.toFixed(2)}% + Reward: {pool.apyReward.toFixed(2)}%
                    </div>
                  )}
                </td>
                <td className="p-4 text-right text-gray-400 hidden lg:table-cell">
                  {formatNumber(pool.tvlUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// CHAINS TAB
// ============================================================

function ChainsTab() {
  const { data: chains, loading, error } = useTopChains(25);
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load chain data</p>
      </div>
    );
  }
  
  // Calculate total TVL for percentage
  const totalTVL = chains?.reduce((sum, c) => sum + (c.tvl || 0), 0) || 1;
  
  return (
    <div className="space-y-6">
      {/* TVL Distribution Chart */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4">TVL Distribution</h3>
        <div className="flex rounded-full h-4 overflow-hidden">
          {chains?.slice(0, 10).map((chain, i) => {
            const percent = (chain.tvl / totalTVL) * 100;
            const colors = [
              'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500',
              'bg-yellow-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500', 'bg-indigo-500'
            ];
            return (
              <div
                key={chain.name}
                className={`${colors[i]} transition-all`}
                style={{ width: `${percent}%` }}
                title={`${chain.name}: ${percent.toFixed(1)}%`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {chains?.slice(0, 10).map((chain, i) => {
            const colors = [
              'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500', 'bg-orange-500',
              'bg-yellow-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500', 'bg-indigo-500'
            ];
            return (
              <div key={chain.name} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded ${colors[i]}`}></div>
                <span className="text-gray-400">{chain.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Chain List */}
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-sm font-medium p-4">#</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4">Chain</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4">TVL</th>
              <th className="text-right text-gray-400 text-sm font-medium p-4 hidden sm:table-cell">% of Total</th>
              <th className="text-left text-gray-400 text-sm font-medium p-4 hidden md:table-cell">Token</th>
            </tr>
          </thead>
          <tbody>
            {chains?.map((chain, index) => (
              <tr key={chain.name} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="p-4 text-gray-500">{index + 1}</td>
                <td className="p-4 text-white font-medium">{chain.name}</td>
                <td className="p-4 text-right text-white font-medium">{formatNumber(chain.tvl)}</td>
                <td className="p-4 text-right text-gray-400 hidden sm:table-cell">
                  {((chain.tvl / totalTVL) * 100).toFixed(2)}%
                </td>
                <td className="p-4 text-gray-400 hidden md:table-cell">{chain.tokenSymbol || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('markets');
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Global Stats Bar */}
      <GlobalStatsBar />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Markets</h1>
            <p className="text-gray-400 mt-1">
              Live cryptocurrency and DeFi market data powered by{' '}
              <span className="text-indigo-400">Lyra MCP</span>
            </p>
          </div>
          <Link
            to="/"
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <div className="flex overflow-x-auto">
            <TabButton active={activeTab === 'markets'} onClick={() => setActiveTab('markets')}>
              🪙 Cryptocurrencies
            </TabButton>
            <TabButton active={activeTab === 'defi'} onClick={() => setActiveTab('defi')}>
              🏦 DeFi Protocols
            </TabButton>
            <TabButton active={activeTab === 'yields'} onClick={() => setActiveTab('yields')}>
              📈 Yields
            </TabButton>
            <TabButton active={activeTab === 'chains'} onClick={() => setActiveTab('chains')}>
              ⛓️ Chains
            </TabButton>
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'markets' && <MarketsTab />}
        {activeTab === 'defi' && <DefiTab />}
        {activeTab === 'yields' && <YieldsTab />}
        {activeTab === 'chains' && <ChainsTab />}
        
        {/* Data Attribution */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Market data from{' '}
            <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              CoinGecko
            </a>
            {' '}•{' '}
            DeFi data from{' '}
            <a href="https://defillama.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              DeFiLlama
            </a>
          </p>
          <p className="mt-2">
            Integrated via <span className="text-purple-400">Lyra MCP Framework</span>
          </p>
        </div>
      </div>
    </div>
  );
}
