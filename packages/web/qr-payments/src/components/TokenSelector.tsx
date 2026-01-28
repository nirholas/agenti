'use client';

import { useState, useEffect, useMemo } from 'react';

// Token type
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  balance?: string;
  balanceUSD?: string;
}

// Popular tokens list
const POPULAR_TOKENS: Token[] = [
  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH', name: 'Ethereum', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
  { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
  { address: '0x6B175474E89094C44Da98b954EescdeCB5BE1e108', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png' },
  { address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC', name: 'Polygon', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png' },
  { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
  { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png' },
];

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token;
  chainId?: number;
  balances?: Record<string, string>;
}

export default function TokenSelector({ 
  isOpen, 
  onClose, 
  onSelect, 
  selectedToken,
  chainId = 1,
  balances = {}
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentTokens, setRecentTokens] = useState<Token[]>([]);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Load recent tokens from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recentTokens');
      if (stored) {
        try {
          setRecentTokens(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse recent tokens', e);
        }
      }
    }
  }, []);

  // Save token to recent list
  const saveToRecent = (token: Token) => {
    const updated = [token, ...recentTokens.filter(t => t.address !== token.address)].slice(0, 5);
    setRecentTokens(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentTokens', JSON.stringify(updated));
    }
  };

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return POPULAR_TOKENS;
    const query = searchQuery.toLowerCase();
    return POPULAR_TOKENS.filter(
      token =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase() === query
    );
  }, [searchQuery]);

  // Handle token selection
  const handleSelect = (token: Token) => {
    saveToRecent(token);
    onSelect(token);
    onClose();
    setSearchQuery('');
  };

  // Import custom token
  const handleImportToken = async () => {
    if (!customTokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(customTokenAddress)) {
      setImportError('Please enter a valid token address');
      return;
    }

    setIsImporting(true);
    setImportError('');

    try {
      // In production, this would fetch token metadata from the blockchain
      // For now, we'll create a placeholder token
      const customToken: Token = {
        address: customTokenAddress,
        symbol: 'CUSTOM',
        name: 'Custom Token',
        decimals: 18,
        chainId,
      };
      
      handleSelect(customToken);
      setCustomTokenAddress('');
    } catch (error) {
      setImportError('Failed to import token');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Select Token</h2>
          <button className="modal-close" onClick={onClose}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-800">
          <div className="input-group">
            <span className="input-icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              className="input"
              placeholder="Search by name, symbol, or address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Body */}
        <div className="modal-body scrollbar-thin">
          {/* Recent Tokens */}
          {recentTokens.length > 0 && !searchQuery && (
            <div className="mb-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recently Used</p>
              <div className="flex flex-wrap gap-2">
                {recentTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors"
                  >
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">
                        {token.symbol.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-medium">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Tokens */}
          <div className="mb-6">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
              {searchQuery ? 'Search Results' : 'Popular Tokens'}
            </p>
            <div className="space-y-1">
              {filteredTokens.map((token) => {
                const balance = balances[token.address];
                const isSelected = selectedToken?.address === token.address;
                
                return (
                  <button
                    key={token.address}
                    onClick={() => handleSelect(token)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                      isSelected 
                        ? 'bg-blue-500/10 border border-blue-500/30' 
                        : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Token Logo */}
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-medium">
                        {token.symbol.charAt(0)}
                      </div>
                    )}
                    
                    {/* Token Info */}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-zinc-500">{token.name}</div>
                    </div>

                    {/* Balance */}
                    {balance && (
                      <div className="text-right">
                        <div className="text-sm font-medium">{parseFloat(balance).toFixed(4)}</div>
                        {token.balanceUSD && (
                          <div className="text-xs text-zinc-500">${token.balanceUSD}</div>
                        )}
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
              })}

              {filteredTokens.length === 0 && searchQuery && (
                <div className="py-8 text-center">
                  <p className="text-zinc-500 mb-4">No tokens found</p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Token Import */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Import Custom Token</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Paste token address (0x...)"
                value={customTokenAddress}
                onChange={(e) => {
                  setCustomTokenAddress(e.target.value);
                  setImportError('');
                }}
              />
              <button
                onClick={handleImportToken}
                disabled={isImporting || !customTokenAddress}
                className="btn btn-secondary"
              >
                {isImporting ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Import'
                )}
              </button>
            </div>
            {importError && (
              <p className="text-sm text-red-400 mt-2">{importError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
