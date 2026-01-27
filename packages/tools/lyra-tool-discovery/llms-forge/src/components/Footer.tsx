'use client'

import { motion } from 'framer-motion'
import { Zap, Github } from 'lucide-react'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold text-white">
                llm.energy
              </span>
            </Link>
            <p className="text-neutral-500 text-sm text-center md:text-left max-w-md">
              Extract llms.txt files and convert them into organized markdown documents ready for AI agents.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a 
              href="https://x.com/nichxbt" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors text-sm"
            >
              @nichxbt
            </a>
            <a 
              href="https://github.com/nirholas" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-lg bg-white/5 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 hover:bg-white/10 transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5 text-neutral-400 hover:text-white" />
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            Created by{' '}
            <a 
              href="https://x.com/nichxbt" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:underline"
            >
              nich
            </a>
          </div>
          <div className="text-sm text-neutral-500">
            Open source on{' '}
            <a 
              href="https://github.com/nirholas/lyra-tool-discovery" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:underline"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
