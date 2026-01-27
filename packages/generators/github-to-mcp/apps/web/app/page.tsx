'use client'

import Header from '@/components/Header'
import Hero from '@/components/Hero'
import ProductCards from '@/components/ProductCards'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Footer from '@/components/Footer'
import ParticleBackground from '@/components/ParticleBackground'
import InstallBanner from '@/components/InstallBanner'
import { motion } from 'framer-motion'
import { Github } from 'lucide-react'

export default function Home() {
  return (
    <main id="main-content" className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Hero with main conversion tool - front and center */}
        <Hero />
        
        {/* Quick links and secondary actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap justify-center gap-4 mt-12 mb-8"
        >
          <a
            href="/#how-it-works"
            className="px-6 py-3 bg-transparent border border-neutral-700 rounded-xl font-semibold text-white hover:border-neutral-500 hover:bg-white/5 transition-all"
          >
            How It Works
          </a>
          <a
            href="/playground"
            className="px-6 py-3 bg-transparent border border-neutral-700 rounded-xl font-semibold text-white hover:border-neutral-500 hover:bg-white/5 transition-all"
          >
            Try Playground
          </a>
          <a
            href="https://github.com/nirholas/github-to-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-transparent border border-neutral-700 rounded-xl font-semibold text-white hover:border-neutral-500 hover:bg-white/5 transition-all flex items-center gap-2"
          >
            <Github className="w-4 h-4" />
            View on GitHub
          </a>
        </motion.div>

        {/* CLI Install Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto mb-16"
        >
          <InstallBanner variant="hero" />
        </motion.div>
        
        {/* All tools and features - accessible from homepage */}
        <ProductCards />
        
        {/* How it works - educational content below */}
        <HowItWorks />
        
        {/* Technical features */}
        <Features />
      </div>
      
      <Footer />
    </main>
  )
}
