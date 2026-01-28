'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useBalance, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import PhoneMockup from '@/components/PhoneMockup';
import LivePrices from '@/components/LivePrices';
import ComparisonSection from '@/components/ComparisonSection';
import CodeExample from '@/components/CodeExample';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import SwapWidget from '@/components/SwapWidget';
import MiniChatApp from '@/components/MiniChatApp';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Opal ambient orbs - pearly with subtle color hints */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Soft pink-white orb */}
        <motion.div
          animate={{
            x: [0, 20, -10, 15, 0],
            y: [0, -20, 10, 15, 0],
            scale: [1, 1.05, 0.95, 1.02, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(255, 250, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Soft pearl orb */}
        <motion.div
          animate={{
            x: [0, -15, 10, -20, 0],
            y: [0, 15, -10, 20, 0],
            scale: [1, 0.95, 1.05, 0.98, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[20%] right-[-5%] w-[450px] h-[450px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(250, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Warm pearl orb */}
        <motion.div
          animate={{
            x: [0, 10, -15, 5, 0],
            y: [0, -10, 15, -5, 0],
            scale: [1, 1.02, 0.98, 1.03, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[50%] left-[30%] w-[300px] h-[300px] rounded-full opacity-35"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 250, 0.07) 0%, rgba(255, 255, 255, 0.03) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Opal shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 20%, rgba(255, 252, 255, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 80%, rgba(252, 255, 255, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.015) 0%, transparent 70%)
            `,
          }}
        />
      </div>

      {/* Fixed header with wallet connection */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-white/20 to-white/5 border border-white/15 rounded-xl flex items-center justify-center opal-shimmer">
              <svg className="w-4 h-4 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-glass">Agenti</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-ghost hover:text-glass transition-colors">Features</a>
            <a href="#swap" className="text-sm text-ghost hover:text-glass transition-colors">Swap</a>
            <a href="/merchant" className="text-sm text-ghost hover:text-glass transition-colors">Merchants</a>
            <a href="/docs" className="text-sm text-ghost hover:text-glass transition-colors">Docs</a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSwap(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all opal-shimmer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Swap
            </button>
            <ConnectButton 
              showBalance={false}
              chainStatus="icon"
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            />
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 pt-16"
      >
        <Hero />
        
        {/* Phone mockup section */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1">
              <PhoneMockup />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-glass text-3xl md:text-4xl font-light mb-4">
                Real-time crypto data
              </h2>
              <p className="text-ghost text-sm md:text-base leading-relaxed mb-6">
                Your AI agent gets instant access to prices, market caps, volume, 
                and historical data for thousands of cryptocurrencies. No rate limits, 
                no API keys, no setup.
              </p>
              <code className="text-whisper text-sm font-mono">
                "What's the price of Bitcoin?"
              </code>
            </div>
          </div>
        </section>

        <LivePrices />
        <Features />
        
        {/* Swap Section */}
        <section id="swap" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 mb-6">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm text-zinc-300">55+ DEXs • 89+ Chains • Live</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-glass">
                Universal
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/90 via-white/70 to-white/50"> Swap</span>
              </h2>
              <p className="text-lg text-ghost max-w-xl mx-auto">
                Trade any token on any chain with the best rates from 55+ aggregators.
              </p>
            </div>
            
            <div className="max-w-md mx-auto">
              <SwapWidget />
            </div>
          </div>
        </section>
        
        <ComparisonSection />
        <CodeExample />
        <FAQ />
        <Footer />
      </motion.main>

      {/* Floating Chat Widget */}
      <MiniChatApp />

      {/* Swap Modal */}
      <AnimatePresence>
        {showSwap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setShowSwap(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="modal max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">Swap Tokens</h2>
                <button className="modal-close" onClick={() => setShowSwap(false)}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <SwapWidget onSuccess={() => setShowSwap(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
