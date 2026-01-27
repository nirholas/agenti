'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Github, FolderOpen, Menu, X, Layers, FileEdit, Terminal, BookOpen } from 'lucide-react'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/directory', label: 'Directory', icon: FolderOpen },
  { href: '/batch', label: 'Batch', icon: Layers },
  { href: '/generator', label: 'llms.txt', icon: FileEdit },
  { href: '/install-generator', label: 'install.md', icon: Terminal },
  { href: '/docs/', label: 'Docs', icon: BookOpen },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Close mobile menu when clicking outside
  const handleOverlayClick = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/80 border-b border-neutral-800"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 md:gap-3 group focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg p-1 -ml-1"
            aria-label="llm.energy home"
          >
            <div className="relative">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-white flex items-center justify-center">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-black" />
              </div>
            </div>
            <span className="text-base md:text-lg font-bold text-white">
              llm.energy
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded px-2 py-1 -mx-2 -my-1"
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <a 
              href="https://github.com/nirholas/lyra-tool-discovery"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white bg-transparent border border-neutral-700 rounded-lg hover:border-neutral-600 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="View on GitHub"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Get started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={handleOverlayClick}
              aria-hidden="true"
            />

            {/* Menu panel */}
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute top-16 left-0 right-0 bg-neutral-900 border-b border-neutral-800 md:hidden"
            >
              <nav className="container mx-auto px-4 py-4" aria-label="Mobile navigation">
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-base text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/20"
                      >
                        {item.icon && <item.icon className="w-5 h-5" />}
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li className="pt-3 border-t border-neutral-800 mt-3">
                    <a
                      href="https://github.com/nirholas/lyra-tool-discovery"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-base text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/20"
                    >
                      <Github className="w-5 h-5" />
                      <span>GitHub</span>
                    </a>
                  </li>
                  <li className="pt-2">
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full text-center px-4 py-3 text-base font-medium bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                    >
                      Get started
                    </Link>
                  </li>
                </ul>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
