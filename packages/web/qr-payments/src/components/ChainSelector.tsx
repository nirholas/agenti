'use client';

import { useState } from 'react';

// Chain type
interface Chain {
  id: number;
  name: string;
  symbol: string;
  color: string;
  logoURI?: string;
  category: 'L1' | 'L2' | 'Alt';
  rpcUrl?: string;
  blockExplorer?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet?: boolean;
}

// Supported chains
const CHAINS: Chain[] = [
  // L1 Chains
  {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    color: '#627EEA',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    category: 'L1',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    color: '#F0B90B',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_binance.jpg',
    category: 'L1',
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  {
    id: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    color: '#E84142',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    category: 'L1',
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  },
  
  // L2 Chains
  {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    color: '#0052FF',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    category: 'L2',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    color: '#28A0F0',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    category: 'L2',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    color: '#FF0420',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    category: 'L2',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    color: '#8247E5',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
    category: 'L2',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  },
  {
    id: 324,
    name: 'zkSync Era',
    symbol: 'ETH',
    color: '#8B8DFC',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_zksync-era.jpg',
    category: 'L2',
    blockExplorer: 'https://explorer.zksync.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  {
    id: 59144,
    name: 'Linea',
    symbol: 'ETH',
    color: '#61DFFF',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
    category: 'L2',
    blockExplorer: 'https://lineascan.build',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  
  // Alt Chains
  {
    id: 101,
    name: 'Solana',
    symbol: 'SOL',
    color: '#9945FF',
    logoURI: 'https://icons.llamao.fi/icons/chains/rsz_solana.jpg',
    category: 'Alt',
    blockExplorer: 'https://solscan.io',
    nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
  },
];

// Mock gas prices (in gwei)
const MOCK_GAS_PRICES: Record<number, { fast: number; standard: number; slow: number }> = {
  1: { fast: 45, standard: 35, slow: 28 },
  56: { fast: 5, standard: 3, slow: 2 },
  43114: { fast: 30, standard: 25, slow: 20 },
  8453: { fast: 0.01, standard: 0.008, slow: 0.005 },
  42161: { fast: 0.1, standard: 0.08, slow: 0.05 },
  10: { fast: 0.01, standard: 0.008, slow: 0.005 },
  137: { fast: 200, standard: 150, slow: 100 },
  324: { fast: 0.25, standard: 0.2, slow: 0.15 },
  59144: { fast: 0.5, standard: 0.4, slow: 0.3 },
  101: { fast: 0.000005, standard: 0.000005, slow: 0.000005 },
};

// Mock network status
const NETWORK_STATUS: Record<number, 'operational' | 'degraded' | 'down'> = {
  1: 'operational',
  56: 'operational',
  43114: 'operational',
  8453: 'operational',
  42161: 'operational',
  10: 'operational',
  137: 'operational',
  324: 'operational',
  59144: 'operational',
  101: 'operational',
};

interface ChainSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (chain: Chain) => void;
  selectedChainId?: number;
}

export default function ChainSelector({
  isOpen,
  onClose,
  onSelect,
  selectedChainId,
}: ChainSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'L1' | 'L2' | 'Alt'>('all');

  // Group chains by category
  const groupedChains = {
    L1: CHAINS.filter(c => c.category === 'L1'),
    L2: CHAINS.filter(c => c.category === 'L2'),
    Alt: CHAINS.filter(c => c.category === 'Alt'),
  };

  // Filter chains based on active category
  const filteredChains = activeCategory === 'all' 
    ? CHAINS 
    : CHAINS.filter(c => c.category === activeCategory);

  const handleSelect = (chain: Chain) => {
    onSelect(chain);
    onClose();
  };

  const getStatusColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational': return 'bg-emerald-400';
      case 'degraded': return 'bg-amber-400';
      case 'down': return 'bg-red-400';
    }
  };

  const getStatusText = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded';
      case 'down': return 'Down';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Select Network</h2>
          <button className="modal-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex gap-2">
            {(['all', 'L1', 'L2', 'Alt'] as const).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === category
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {category === 'all' ? 'All Networks' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body scrollbar-thin">
          {activeCategory === 'all' ? (
            // Grouped view
            <>
              {Object.entries(groupedChains).map(([category, chains]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    {category === 'L1' && 'Layer 1'}
                    {category === 'L2' && 'Layer 2'}
                    {category === 'Alt' && 'Alternative'}
                    <span className="text-zinc-600">({chains.length})</span>
                  </p>
                  <div className="space-y-1">
                    {chains.map((chain) => (
                      <ChainItem
                        key={chain.id}
                        chain={chain}
                        isSelected={selectedChainId === chain.id}
                        gasPrice={MOCK_GAS_PRICES[chain.id]}
                        status={NETWORK_STATUS[chain.id]}
                        onSelect={() => handleSelect(chain)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            // Flat view
            <div className="space-y-1">
              {filteredChains.map((chain) => (
                <ChainItem
                  key={chain.id}
                  chain={chain}
                  isSelected={selectedChainId === chain.id}
                  gasPrice={MOCK_GAS_PRICES[chain.id]}
                  status={NETWORK_STATUS[chain.id]}
                  onSelect={() => handleSelect(chain)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Chain Item Component
interface ChainItemProps {
  chain: Chain;
  isSelected: boolean;
  gasPrice?: { fast: number; standard: number; slow: number };
  status?: 'operational' | 'degraded' | 'down';
  onSelect: () => void;
}

function ChainItem({ chain, isSelected, gasPrice, status = 'operational', onSelect }: ChainItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
        isSelected
          ? 'bg-blue-500/10 border border-blue-500/30'
          : 'hover:bg-zinc-800/50'
      }`}
    >
      {/* Chain Logo */}
      <div className="relative">
        {chain.logoURI ? (
          <img src={chain.logoURI} alt={chain.name} className="w-10 h-10 rounded-full" />
        ) : (
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: chain.color + '20', color: chain.color }}
          >
            {chain.symbol.charAt(0)}
          </div>
        )}
        {/* Status indicator */}
        <div 
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
            status === 'operational' ? 'bg-emerald-400' :
            status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
          }`}
          title={status === 'operational' ? 'Operational' : status === 'degraded' ? 'Degraded' : 'Down'}
        />
      </div>

      {/* Chain Info */}
      <div className="flex-1 text-left">
        <div className="font-medium flex items-center gap-2">
          {chain.name}
          {chain.isTestnet && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">
              Testnet
            </span>
          )}
        </div>
        <div className="text-sm text-zinc-500 flex items-center gap-2">
          <span>{chain.nativeCurrency.symbol}</span>
          {gasPrice && (
            <>
              <span className="text-zinc-700">•</span>
              <span className="text-zinc-400">
                {gasPrice.standard < 1 
                  ? `${(gasPrice.standard * 1000).toFixed(2)} mGwei` 
                  : `${gasPrice.standard.toFixed(0)} Gwei`
                }
              </span>
            </>
          )}
        </div>
      </div>

      {/* Gas Price Indicator */}
      {gasPrice && (
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${
            gasPrice.standard < 10 ? 'bg-emerald-400' :
            gasPrice.standard < 50 ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          <span className="text-xs text-zinc-500">
            {gasPrice.standard < 10 ? 'Low' : gasPrice.standard < 50 ? 'Med' : 'High'}
          </span>
        </div>
      )}

      {/* Selected Indicator */}
      {isSelected && (
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

// Export chains for use in other components
export { CHAINS, type Chain };
