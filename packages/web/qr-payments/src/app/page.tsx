'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import QRCode from 'qrcode';
import TokenSelector from '@/components/TokenSelector';
import ChainSelector, { CHAINS as CHAIN_LIST, type Chain } from '@/components/ChainSelector';
import TransactionHistory, { type Transaction } from '@/components/TransactionHistory';

// 55+ Protocols
const PROTOCOLS = [
  '1inch', '0x', 'Paraswap', 'Odos', 'KyberSwap', 'OpenOcean', 'CowSwap',
  'Uniswap', 'SushiSwap', 'PancakeSwap', 'Curve', 'Balancer',
  'Velodrome', 'Aerodrome', 'Camelot', 'TraderJoe', 'GMX',
  'Jupiter', 'Raydium', 'Orca', 'Meteora', 'Phoenix',
  'Stargate', 'Across', 'Hop', 'Synapse', 'LayerZero',
  'Maverick', 'DODO', 'Hashflow', 'WOOFi', 'Bancor', 'QuickSwap',
];

const CHAINS = [
  { name: 'Ethereum', symbol: 'ETH', color: '#627EEA', id: 1 },
  { name: 'Solana', symbol: 'SOL', color: '#9945FF', id: 101 },
  { name: 'Base', symbol: 'BASE', color: '#0052FF', id: 8453 },
  { name: 'Arbitrum', symbol: 'ARB', color: '#28A0F0', id: 42161 },
  { name: 'Optimism', symbol: 'OP', color: '#FF0420', id: 10 },
  { name: 'Polygon', symbol: 'MATIC', color: '#8247E5', id: 137 },
  { name: 'Avalanche', symbol: 'AVAX', color: '#E84142', id: 43114 },
  { name: 'BSC', symbol: 'BNB', color: '#F0B90B', id: 56 },
  { name: 'zkSync', symbol: 'ZK', color: '#8B8DFC', id: 324 },
  { name: 'Linea', symbol: 'LINEA', color: '#61DFFF', id: 59144 },
];

// Token type for swap interface
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

// Quote type
interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  route: string;
  estimatedGas: string;
  aggregator: string;
}

// Notification type
interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'pay' | 'receive' | 'history'>('pay');
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Add notification
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-zinc-900/50 via-black to-black pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight">Agenti</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">API</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
          </div>
          
          <ConnectButton 
            showBalance={false}
            chainStatus="icon"
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
          />
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm text-zinc-300">{PROTOCOLS.length}+ DEXs • {CHAINS.length} Chains • Live</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Universal Crypto
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-500">
              Payment Protocol
            </span>
          </h1>
          
          <p className="text-lg text-zinc-400 mb-12 max-w-xl mx-auto leading-relaxed">
            Accept any token on any chain. We aggregate {PROTOCOLS.length}+ DEXs to convert payments to USDC instantly. Zero platform fees.
          </p>
          
          {/* Tab Switcher */}
          <div className="inline-flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('pay')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pay' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Send Payment
            </button>
            <button
              onClick={() => setActiveTab('receive')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'receive' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Receive
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'history' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              History
            </button>
          </div>
        </div>
      </section>

      {/* Main Form */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-md mx-auto">
          {activeTab === 'pay' ? (
            <PaymentForm isConnected={isConnected} onNotify={addNotification} />
          ) : activeTab === 'receive' ? (
            <ReceiveForm address={address} />
          ) : (
            <div className="max-w-2xl mx-auto">
              <TransactionHistory />
            </div>
          )}
        </div>
      </section>

      {/* Toast Notifications */}
      {notifications.length > 0 && (
        <div className="toast-container">
          {notifications.map((notification) => (
            <div key={notification.id} className={`toast toast-${notification.type}`}>
              <div className="toast-icon">
                {notification.type === 'success' && (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {notification.type === 'error' && (
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {notification.type === 'warning' && (
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {notification.type === 'info' && (
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="toast-content">
                <p className="toast-title">{notification.title}</p>
                <p className="toast-message">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="text-zinc-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Protocol Marquee */}
      <section className="relative z-10 py-12 border-t border-zinc-900">
        <p className="text-center text-xs text-zinc-600 mb-6 uppercase tracking-widest">
          Routing through {PROTOCOLS.length}+ protocols
        </p>
        <div className="overflow-hidden">
          <div className="flex gap-3 animate-marquee">
            {[...PROTOCOLS, ...PROTOCOLS].map((name, i) => (
              <span 
                key={`${name}-${i}`}
                className="shrink-0 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-xs text-zinc-500"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-24 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Agenti?</h2>
            <p className="text-zinc-500 max-w-lg mx-auto">
              The most powerful payment infrastructure in crypto.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              title="Any Token → USDC"
              description="Payer uses any token. You always receive USDC. Zero confusion."
            />
            <FeatureCard
              title="@Username Payments"
              description="Link your X, ENS, or .sol handle. Get paid with just your name."
            />
            <FeatureCard
              title="Best Rate Guarantee"
              description="We query 55+ DEXs in real-time. Always the optimal route."
            />
            <FeatureCard
              title="QR Code Commerce"
              description="Generate payment QR codes for fixed or variable amounts."
            />
            <FeatureCard
              title="Non-Custodial"
              description="Smart contracts handle atomic swaps. We never touch funds."
            />
            <FeatureCard
              title="Instant Settlement"
              description="Sub-2 second finality on L2s. Funds arrive immediately."
            />
          </div>
        </div>
      </section>

      {/* Chains */}
      <section className="relative z-10 px-6 py-16 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-zinc-600 mb-6 uppercase tracking-widest">Supported Networks</p>
          <div className="flex flex-wrap justify-center gap-2">
            {CHAINS.map((chain) => (
              <div 
                key={chain.name}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chain.color }} />
                <span className="text-sm text-zinc-400">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section className="relative z-10 px-6 py-20 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 md:p-10">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              For Developers
            </div>
            
            <h3 className="text-2xl font-bold mb-3">Integrate in 5 minutes</h3>
            <p className="text-zinc-400 mb-6">
              One API endpoint. Any token in, USDC out.
            </p>
            
            {/* Code Block */}
            <div className="bg-black border border-zinc-800 rounded-xl p-4 font-mono text-sm mb-6 overflow-x-auto">
              <div className="text-zinc-500">// Accept payment in any token</div>
              <div className="mt-1">
                <span className="text-blue-400">const</span>{' '}
                <span className="text-zinc-300">payment</span>{' '}
                <span className="text-zinc-500">=</span>{' '}
                <span className="text-blue-400">await</span>{' '}
                <span className="text-zinc-300">agenti.createPayment</span>
                <span className="text-zinc-500">(&#123;</span>
              </div>
              <div className="pl-4 text-zinc-300">
                amount: <span className="text-emerald-400">"100.00"</span>,
              </div>
              <div className="pl-4 text-zinc-300">
                currency: <span className="text-emerald-400">"USDC"</span>,
              </div>
              <div className="pl-4 text-zinc-300">
                acceptAny: <span className="text-blue-400">true</span>
              </div>
              <div className="text-zinc-500">&#125;);</div>
            </div>
            
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors">
                Read Docs
              </button>
              <button className="px-5 py-2.5 bg-zinc-800 border border-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
                View GitHub
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
              </svg>
            </div>
            © 2026 Agenti Protocol
          </div>
          <div className="flex gap-6 text-sm text-zinc-600">
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </main>
  );
}

// ============= PAYMENT FORM =============

interface PaymentFormProps {
  isConnected: boolean;
  onNotify: (notification: Omit<Notification, 'id'>) => void;
}

function PaymentForm({ isConnected, onNotify }: PaymentFormProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Selected token and chain
  const [selectedToken, setSelectedToken] = useState<Token>({
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    chainId: 1,
    logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    balance: '2.5',
    balanceUSD: '6,250.00',
  });
  
  const [selectedChain, setSelectedChain] = useState({
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    color: '#627EEA',
  });

  // Mock quote
  const [quote, setQuote] = useState<SwapQuote | null>(null);

  // Fetch quote when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      setIsQuoting(true);
      const timer = setTimeout(() => {
        // Mock quote calculation
        const inputNum = parseFloat(amount);
        const mockPriceImpact = inputNum > 10000 ? 3.5 : inputNum > 1000 ? 1.2 : 0.3;
        
        setQuote({
          inputAmount: amount,
          outputAmount: (inputNum * 0.999).toFixed(2),
          priceImpact: mockPriceImpact,
          route: `${selectedToken.symbol} → WETH → USDC`,
          estimatedGas: '$2.50',
          aggregator: '1inch',
        });
        setIsQuoting(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setQuote(null);
    }
  }, [amount, selectedToken]);

  const handleMaxClick = () => {
    if (selectedToken.balance) {
      setAmount(selectedToken.balance);
    }
  };

  const handleSubmit = async () => {
    if (!isConnected || !quote) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSwap = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    
    // Simulate transaction
    await new Promise(r => setTimeout(r, 2000));
    
    setIsLoading(false);
    setAmount('');
    setRecipient('');
    setQuote(null);
    
    onNotify({
      type: 'success',
      title: 'Payment Sent!',
      message: `Successfully sent ${quote?.outputAmount} USDC`,
    });
  };

  const getPriceImpactClass = (impact: number) => {
    if (impact < 1) return 'price-impact-low';
    if (impact < 3) return 'price-impact-medium';
    return 'price-impact-high';
  };

  return (
    <>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Send Payment</h2>
          <div className="flex items-center gap-3">
            {/* Chain Selector Button */}
            <button
              onClick={() => setShowChainSelector(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedChain.color }} />
              <span className="text-sm">{selectedChain.name}</span>
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="@username, ENS, or 0x..."
              className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          
          {/* Amount with Token Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">You Pay</label>
              {selectedToken.balance && (
                <span className="text-xs text-zinc-500">
                  Balance: {selectedToken.balance} {selectedToken.symbol}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white text-xl font-medium placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition-colors pr-16"
                />
                {selectedToken.balance && (
                  <button
                    onClick={handleMaxClick}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded transition-colors"
                  >
                    MAX
                  </button>
                )}
              </div>
              
              {/* Token Selector Button */}
              <button
                onClick={() => setShowTokenSelector(true)}
                className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors min-w-[140px]"
              >
                {selectedToken.logoURI ? (
                  <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-sm">
                    {selectedToken.symbol.charAt(0)}
                  </div>
                )}
                <span className="font-medium">{selectedToken.symbol}</span>
                <svg className="w-4 h-4 text-zinc-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* Output - Recipient Gets */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Recipient Gets</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={quote ? quote.outputAmount : ''}
                  readOnly
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-black/50 border border-zinc-800 rounded-xl text-white text-xl font-medium placeholder:text-zinc-600 cursor-not-allowed"
                />
                {isQuoting && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin w-5 h-5 text-blue-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* USDC Fixed */}
              <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl min-w-[140px]">
                <img src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png" alt="USDC" className="w-6 h-6 rounded-full" />
                <span className="font-medium">USDC</span>
              </div>
            </div>
          </div>

          {/* Quote Preview */}
          {quote && (
            <div className="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Route</span>
                <span className="text-zinc-300">{quote.route}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Price Impact</span>
                <span className={getPriceImpactClass(quote.priceImpact)}>
                  {quote.priceImpact.toFixed(2)}%
                  {quote.priceImpact >= 2 && (
                    <span className="ml-1">⚠️</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Network fee</span>
                <span className="text-zinc-400">{quote.estimatedGas}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Platform fee</span>
                <span className="text-emerald-400">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Aggregator</span>
                <span className="text-zinc-400">{quote.aggregator}</span>
              </div>
              
              {/* Price Impact Warning */}
              {quote.priceImpact >= 2 && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">High Price Impact</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    This trade has a price impact of {quote.priceImpact.toFixed(2)}%. Consider splitting into smaller trades.
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Submit Button */}
          {isConnected ? (
            <button 
              onClick={handleSubmit}
              disabled={!recipient || !amount || isLoading || isQuoting || !quote}
              className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : isQuoting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Finding best route...
                </span>
              ) : quote && quote.priceImpact >= 3 ? (
                'Swap Anyway'
              ) : (
                'Review Swap'
              )}
            </button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          )}
          
          <p className="text-[11px] text-zinc-600 text-center">
            Zero fees • Best rate from 55+ DEXs
          </p>
        </div>
      </div>

      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        onSelect={(token: Token) => setSelectedToken(token)}
        selectedToken={selectedToken}
        chainId={selectedChain.id}
      />

      {/* Chain Selector Modal */}
      <ChainSelector
        isOpen={showChainSelector}
        onClose={() => setShowChainSelector(false)}
        onSelect={(chain: Chain) => setSelectedChain({ id: chain.id, name: chain.name, symbol: chain.symbol, color: chain.color })}
        selectedChainId={selectedChain.id}
      />

      {/* Transaction Confirmation Modal */}
      {showConfirmModal && quote && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Swap</h2>
              <button className="modal-close" onClick={() => setShowConfirmModal(false)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body space-y-4">
              {/* From */}
              <div className="p-4 bg-zinc-900 rounded-xl">
                <p className="text-xs text-zinc-500 mb-2">You Pay</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{amount}</span>
                  <div className="flex items-center gap-2">
                    {selectedToken.logoURI && (
                      <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full" />
                    )}
                    <span className="font-medium">{selectedToken.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* To */}
              <div className="p-4 bg-zinc-900 rounded-xl">
                <p className="text-xs text-zinc-500 mb-2">Recipient Gets</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{quote.outputAmount}</span>
                  <div className="flex items-center gap-2">
                    <img src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png" alt="USDC" className="w-6 h-6 rounded-full" />
                    <span className="font-medium">USDC</span>
                  </div>
                </div>
              </div>

              {/* Recipient */}
              <div className="p-4 bg-zinc-900 rounded-xl">
                <p className="text-xs text-zinc-500 mb-1">Sending to</p>
                <p className="font-mono text-sm truncate">{recipient}</p>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Network</span>
                  <span>{selectedChain.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Price Impact</span>
                  <span className={getPriceImpactClass(quote.priceImpact)}>{quote.priceImpact.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Estimated Gas</span>
                  <span>{quote.estimatedGas}</span>
                </div>
              </div>

              {quote.priceImpact >= 2 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                  ⚠️ High price impact. You may receive significantly less than expected.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary flex-1" onClick={handleConfirmSwap}>
                Confirm Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============= RECEIVE FORM =============

function ReceiveForm({ address }: { address?: string }) {
  const [username, setUsername] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const paymentUrl = `https://agenti.cash/pay/${username || address}${fixedAmount ? `?amount=${fixedAmount}` : ''}`;

  const generateQR = async () => {
    if (!address) return;
    try {
      const url = await QRCode.toDataURL(paymentUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-6">Receive Payments</h2>
      
      <div className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Your Handle</label>
          <div className="flex">
            <span className="px-4 py-3 bg-zinc-800 rounded-l-xl border border-r-0 border-zinc-700 text-zinc-400 text-sm">
              agenti.cash/
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              className="flex-1 px-4 py-3 bg-black border border-zinc-800 rounded-r-xl text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
        
        {/* Amount */}
        <div>
          <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wider">Fixed Amount (optional)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
              placeholder="Any amount"
              className="w-full pl-8 pr-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
        
        {/* Generate Button */}
        {address ? (
          <button 
            onClick={generateQR}
            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
          >
            Generate Payment Link
          </button>
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        )}
        
        {/* QR Output */}
        {qrDataUrl ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-white rounded-xl flex items-center justify-center">
              <img src={qrDataUrl} alt="Payment QR" className="w-48 h-48" />
            </div>
            
            <div className="p-3 bg-black border border-zinc-800 rounded-xl">
              <p className="text-xs text-zinc-500 truncate font-mono">{paymentUrl}</p>
            </div>
            
            <div className="flex gap-2">
              <a 
                href={qrDataUrl} 
                download="agenti-qr.png"
                className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-medium text-center hover:bg-zinc-700 transition-colors"
              >
                Download
              </a>
              <button 
                onClick={copyLink}
                className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        ) : address && (
          <div className="mt-4 p-8 bg-black border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center">
            <svg className="w-10 h-10 text-zinc-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <p className="text-zinc-600 text-sm">QR code will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= FEATURE CARD =============

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-5 bg-zinc-900/30 border border-zinc-800/50 rounded-xl hover:border-zinc-700 transition-colors">
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}
