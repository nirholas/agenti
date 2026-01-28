'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { getBestQuote, type SwapQuote, type SwapRequest } from '@/lib/crossfund/swap';
import { POPULAR_TOKENS, USDC_ADDRESSES, type TokenInfo, NATIVE_TOKEN_ADDRESS } from '@/lib/tokens/lists';
import { CHAINS, MAIN_CHAINS, type ChainConfig } from '@/lib/chains/config';

interface SwapWidgetProps {
  onSuccess?: () => void;
  defaultFromToken?: TokenInfo;
  defaultToToken?: TokenInfo;
}

const SUPPORTED_CHAINS = MAIN_CHAINS.map(id => CHAINS[id]).filter(Boolean) as ChainConfig[];

export default function SwapWidget({ onSuccess, defaultFromToken, defaultToToken }: SwapWidgetProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { sendTransaction, isPending: isSending } = useSendTransaction();
  const { switchChain } = useSwitchChain();

  // Token state
  const [fromToken, setFromToken] = useState<TokenInfo | null>(
    defaultFromToken || POPULAR_TOKENS.find(t => t.symbol === 'ETH' && t.chainId === 1) || null
  );
  const [toToken, setToToken] = useState<TokenInfo | null>(
    defaultToToken || POPULAR_TOKENS.find(t => t.symbol === 'USDC' && t.chainId === 1) || null
  );

  // Amount state
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  // Quote state
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [allQuotes, setAllQuotes] = useState<SwapQuote[]>([]);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // UI state
  const [showFromTokenSelect, setShowFromTokenSelect] = useState(false);
  const [showToTokenSelect, setShowToTokenSelect] = useState(false);
  const [showChainSelect, setShowChainSelect] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainConfig>(CHAINS[1]);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);

  // Debounced quote fetching
  useEffect(() => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      setToAmount('');
      return;
    }

    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);

      try {
        const amountInWei = parseUnits(fromAmount, fromToken.decimals).toString();

        const request: SwapRequest = {
          fromChainId: selectedChain.id,
          toChainId: selectedChain.id, // Same chain swap
          fromAssetAddress: fromToken.address,
          toAssetAddress: toToken.address,
          inputAmountHuman: amountInWei,
          userWalletAddress: address || '0x0000000000000000000000000000000000000000',
          slippage,
        };

        const response = await getBestQuote(request);

        if (response.success && response.quote) {
          setQuote(response.quote);
          setAllQuotes(response.quotes || []);

          // Format output amount
          const outputFormatted = formatUnits(BigInt(response.quote.outputAmount), toToken.decimals);
          setToAmount(parseFloat(outputFormatted).toFixed(6));
        } else {
          setQuoteError(response.error?.message || 'Failed to get quote');
        }
      } catch (err) {
        console.error('Quote error:', err);
        setQuoteError('Failed to fetch quote');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounceTimer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [fromToken, toToken, fromAmount, selectedChain, address, slippage]);

  // Switch tokens
  const handleSwitchTokens = useCallback(() => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  }, [fromToken, toToken, fromAmount, toAmount]);

  // Execute swap
  const handleSwap = async () => {
    if (!quote?.txData || !address) return;

    try {
      // Switch chain if needed
      if (chainId !== selectedChain.id) {
        await switchChain({ chainId: selectedChain.id });
      }

      sendTransaction({
        to: quote.txData.to as `0x${string}`,
        data: quote.txData.data as `0x${string}`,
        value: BigInt(quote.txData.value || '0'),
      });

      onSuccess?.();
    } catch (err) {
      console.error('Swap error:', err);
    }
  };

  // Get tokens for selected chain
  const chainTokens = POPULAR_TOKENS.filter(t => t.chainId === selectedChain.id);

  return (
    <div className="glass-panel p-6">
      {/* Chain selector */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setShowChainSelect(!showChainSelect)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <div
            className="w-5 h-5 rounded-full"
            style={{ backgroundColor: selectedChain.color }}
          />
          <span className="text-sm font-medium">{selectedChain.name}</span>
          <svg className="w-4 h-4 text-ghost" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-ghost" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-4 bg-white/5 rounded-lg mb-4">
              <label className="text-sm text-ghost mb-2 block">Slippage Tolerance</label>
              <div className="flex gap-2">
                {[0.1, 0.5, 1.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSlippage(val)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      slippage === val
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/5 text-ghost hover:bg-white/10'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                  className="w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-right"
                  step="0.1"
                  min="0.01"
                  max="50"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* From token */}
      <div className="p-4 bg-white/5 rounded-xl mb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-ghost">From</span>
          {isConnected && (
            <span className="text-xs text-ghost">Balance: -</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFromTokenSelect(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors min-w-[120px]"
          >
            {fromToken?.logoURI && (
              <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
            )}
            <span className="font-medium">{fromToken?.symbol || 'Select'}</span>
            <svg className="w-4 h-4 text-ghost" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-medium text-right outline-none placeholder:text-ghost/50"
          />
        </div>
      </div>

      {/* Switch button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleSwitchTokens}
          className="p-2 bg-zinc-900 border border-white/10 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4m0 12l-4-4m4 4l4-4" />
            <path d="M17 8v12m0-12l4 4m-4-4l-4 4" />
          </svg>
        </button>
      </div>

      {/* To token */}
      <div className="p-4 bg-white/5 rounded-xl mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-ghost">To</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowToTokenSelect(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors min-w-[120px]"
          >
            {toToken?.logoURI && (
              <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
            )}
            <span className="font-medium">{toToken?.symbol || 'Select'}</span>
            <svg className="w-4 h-4 text-ghost" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <input
            type="text"
            value={isLoadingQuote ? '...' : toAmount}
            readOnly
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-medium text-right outline-none placeholder:text-ghost/50"
          />
        </div>
      </div>

      {/* Quote info */}
      {quote && !isLoadingQuote && (
        <div className="p-3 bg-white/5 rounded-lg mb-4 space-y-2 text-sm">
          <div className="flex justify-between text-ghost">
            <span>Rate</span>
            <span>
              1 {fromToken?.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken?.symbol}
            </span>
          </div>
          <div className="flex justify-between text-ghost">
            <span>Aggregator</span>
            <span className="capitalize">{quote.aggregator}</span>
          </div>
          <div className="flex justify-between text-ghost">
            <span>Price Impact</span>
            <span className={quote.priceImpact > 3 ? 'text-red-400' : ''}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-ghost">
            <span>Est. Gas</span>
            <span>{parseInt(quote.estimatedGas).toLocaleString()}</span>
          </div>
          {allQuotes.length > 1 && (
            <div className="flex justify-between text-ghost">
              <span>Quotes found</span>
              <span>{allQuotes.length} aggregators</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {quoteError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4 text-red-400 text-sm">
          {quoteError}
        </div>
      )}

      {/* Swap button */}
      {isConnected ? (
        <button
          onClick={handleSwap}
          disabled={!quote || isLoadingQuote || isSending}
          className="w-full glass-button-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Swapping...
            </span>
          ) : isLoadingQuote ? (
            'Fetching quote...'
          ) : chainId !== selectedChain.id ? (
            `Switch to ${selectedChain.name}`
          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
            'Enter amount'
          ) : !quote ? (
            'No route found'
          ) : (
            'Swap'
          )}
        </button>
      ) : (
        <div className="text-center py-4 text-ghost">
          Connect wallet to swap
        </div>
      )}

      {/* Chain select modal */}
      <AnimatePresence>
        {showChainSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setShowChainSelect(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title">Select Chain</h3>
                <button className="modal-close" onClick={() => setShowChainSelect(false)}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body space-y-1">
                {SUPPORTED_CHAINS.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      setSelectedChain(chain);
                      setShowChainSelect(false);
                      // Update tokens for new chain
                      const nativeToken = POPULAR_TOKENS.find(
                        t => t.address === NATIVE_TOKEN_ADDRESS && t.chainId === chain.id
                      );
                      if (nativeToken) setFromToken(nativeToken);
                      const usdc = USDC_ADDRESSES[chain.id];
                      if (usdc) {
                        setToToken({
                          address: usdc,
                          chainId: chain.id,
                          name: 'USD Coin',
                          symbol: 'USDC',
                          decimals: 6,
                          logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
                        });
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      selectedChain.id === chain.id
                        ? 'bg-blue-500/20 border border-blue-500/30'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{chain.name}</div>
                      <div className="text-xs text-ghost">{chain.protocols.slice(0, 3).join(', ')}</div>
                    </div>
                    {selectedChain.id === chain.id && (
                      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token select modals */}
      <AnimatePresence>
        {(showFromTokenSelect || showToTokenSelect) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => {
              setShowFromTokenSelect(false);
              setShowToTokenSelect(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title">Select Token</h3>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowFromTokenSelect(false);
                    setShowToTokenSelect(false);
                  }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body space-y-1">
                {chainTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => {
                      if (showFromTokenSelect) {
                        setFromToken(token);
                        setShowFromTokenSelect(false);
                      } else {
                        setToToken(token);
                        setShowToTokenSelect(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">
                        {token.symbol[0]}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-ghost">{token.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
