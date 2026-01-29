'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function MerchantPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-4 h-4 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">Agenti</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</Link>
            <Link href="/#swap" className="text-sm text-white/60 hover:text-white transition-colors">Swap</Link>
            <Link href="/merchant" className="text-sm text-white transition-colors">Merchants</Link>
            <Link href="/docs" className="text-sm text-white/60 hover:text-white transition-colors">Docs</Link>
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Accept Crypto Payments
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Let your customers pay with any token on any chain. Receive USDC instantly.
            </p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {[
              {
                title: 'Any Token, Any Chain',
                description: 'Accept 10,000+ tokens across 89+ chains. We handle the swaps automatically.',
                icon: '🔄'
              },
              {
                title: 'Instant Settlement',
                description: 'Receive USDC in your wallet within seconds of payment confirmation.',
                icon: '⚡'
              },
              {
                title: 'Zero Integration',
                description: 'Just share a payment link or QR code. No SDK, no API keys required.',
                icon: '🔗'
              },
              {
                title: 'Best Rates',
                description: '55+ DEX aggregators compete to give your customers the best swap rates.',
                icon: '📈'
              }
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <p className="text-white/40 mb-6">Coming soon — join the waitlist</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://twitter.com/nichxbt"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors"
              >
                Follow for Updates
              </a>
              <Link
                href="/"
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
