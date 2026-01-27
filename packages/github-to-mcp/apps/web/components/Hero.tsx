'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Github, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import GithubUrlInput from '@/components/GithubUrlInput'

const QUICK_TRY = [
  { name: 'MCP Servers', url: 'https://github.com/modelcontextprotocol/servers' },
  { name: 'Anthropic Cookbook', url: 'https://github.com/anthropics/anthropic-cookbook' },
  { name: 'Vercel AI', url: 'https://github.com/vercel/ai' },
]

export default function Hero() {
  const router = useRouter()
  const [isConverting, setIsConverting] = useState(false)

  const handleSubmit = useCallback((url: string) => {
    setIsConverting(true)
    const finalUrl = url.startsWith('http') ? url : `https://${url}`
    router.push(`/convert?url=${encodeURIComponent(finalUrl)}`)
  }, [router])

  const handleQuickTry = useCallback((repoUrl: string) => {
    router.push(`/convert?url=${encodeURIComponent(repoUrl)}`)
  }, [router])

  return (
    <div className="text-center py-8">
      {/* Badge */}
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
        <span className="block text-white">Convert GitHub Repos</span>
        <span className="block text-neutral-500">to MCP Servers</span>
      </motion.h1>

      {/* Short subheadline */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-xl text-neutral-400 mb-10"
      >
        Transform any GitHub repository into a Model Context Protocol server for AI agents
      </motion.p>

      {/* Main URL Input - THE CORE TOOL */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-2xl mx-auto mb-4"
      >
        <GithubUrlInput 
          onSubmit={handleSubmit}
          disabled={isConverting}
        />
      </motion.div>

      {/* Quick try buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex flex-wrap justify-center items-center gap-2 mb-8"
        role="group"
        aria-label="Example repositories"
      >
        <span className="text-sm text-neutral-500">Try:</span>
        {QUICK_TRY.map((repo) => (
          <button
            key={repo.name}
            type="button"
            onClick={() => handleQuickTry(repo.url)}
            className="px-3 py-1.5 text-sm bg-white/5 border border-neutral-800 rounded-lg hover:border-neutral-600 hover:bg-white/10 transition-all text-neutral-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label={`Convert ${repo.name} repository`}
          >
            {repo.name}
          </button>
        ))}
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap justify-center items-center gap-2 text-xs text-neutral-500"
      >
        <span>Smart extraction</span>
        <span className="text-neutral-700">•</span>
        <span>TypeScript & Python</span>
        <span className="text-neutral-700">•</span>
        <span>Ready-to-use configs</span>
        <span className="text-neutral-700">•</span>
        <span>Interactive playground</span>
      </motion.div>
    </div>
  )
}
