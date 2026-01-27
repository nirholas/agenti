'use client'

import { motion } from 'framer-motion'
import { Github, ArrowRight, FileText, Bot, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import UrlInput from './UrlInput'

const QUICK_TRY = [
  { name: 'Axiom', url: 'https://docs.axiom.trade' },
  { name: 'Mintlify', url: 'https://mintlify.com' },
  { name: 'Cursor', url: 'https://cursor.com' },
  { name: 'Anthropic', url: 'https://docs.anthropic.com' },
]

export default function Hero() {
  const router = useRouter()

  const handleSubmit = (url: string) => {
    router.push(`/extract?url=${encodeURIComponent(url)}`)
  }

  const handleQuickTry = (url: string) => {
    router.push(`/extract?url=${encodeURIComponent(url)}`)
  }

  return (
    <div className="text-center py-12">
      {/* Badge - Moved up, closer to header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
      >
        <Github className="w-4 h-4 text-white/60" />
        <span className="text-sm font-medium text-neutral-400">
          Free & <span className="text-white font-semibold">Open Source</span>
        </span>
      </motion.div>

      {/* Main heading */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl md:text-7xl font-bold mb-4 leading-[1.1] tracking-tight"
      >
        <span className="block text-white">Extract Documentation</span>
        <span className="block text-neutral-500">for AI Agents</span>
      </motion.h1>

      {/* Short subheadline */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-xl text-neutral-400 mb-8"
      >
        Enter any URL to get started
      </motion.p>

      {/* URL Input - PROMINENT, centerpiece */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-2xl mx-auto mb-4"
      >
        <UrlInput onSubmit={handleSubmit} />
      </motion.div>

      {/* Quick try buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex flex-wrap justify-center items-center gap-2 mb-4"
      >
        <span className="text-sm text-neutral-500">Try:</span>
        {QUICK_TRY.map((site, i) => (
          <button
            key={site.name}
            onClick={() => handleQuickTry(site.url)}
            className="px-3 py-1.5 text-sm bg-white/5 border border-neutral-800 rounded-lg hover:border-neutral-600 hover:bg-white/10 transition-all text-neutral-400 hover:text-white"
          >
            {site.name}
          </button>
        ))}
      </motion.div>

      {/* Feature pills - small, muted */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center items-center gap-2 text-xs text-neutral-500 mb-16"
      >
        <span>Auto-detects llms.txt</span>
        <span className="text-neutral-700">•</span>
        <span>Organized markdown</span>
        <span className="text-neutral-700">•</span>
        <span>Agent-ready format</span>
      </motion.div>

      {/* Longer description - moved down with spacing */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-lg text-neutral-400 max-w-2xl mx-auto mb-8 leading-relaxed"
      >
        Instantly fetch and organize documentation into downloadable markdown documents ready for Claude, ChatGPT, and other AI assistants.
      </motion.p>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap justify-center gap-4 mb-12"
      >
        <a
          href="#how-it-works"
          className="px-6 py-3 bg-transparent border border-neutral-700 rounded-xl font-semibold text-white hover:border-neutral-500 hover:bg-white/5 transition-all"
        >
          How It Works
        </a>
        <a
          href="https://github.com/nirholas/lyra-tool-discovery"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-transparent border border-neutral-700 rounded-xl font-semibold text-white hover:border-neutral-500 hover:bg-white/5 transition-all flex items-center gap-2"
        >
          <Github className="w-4 h-4" />
          View on GitHub
        </a>
      </motion.div>

      {/* Key features - visual summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex flex-wrap justify-center gap-8 text-sm"
      >
        {[
          { icon: FileText, label: 'Fetches llms.txt', desc: 'Automatic discovery' },
          { icon: Bot, label: 'Agent-ready output', desc: 'Organized markdown files' },
          { icon: Download, label: 'One-click download', desc: 'Individual or ZIP bundle' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-neutral-800 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-white">{item.label}</div>
              <div className="text-neutral-500 text-xs">{item.desc}</div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
