'use client'

import { motion } from 'framer-motion'
import { Zap, Github, FileText, BookOpen, Layers, FolderOpen, Terminal, FileEdit } from 'lucide-react'
import Link from 'next/link'

const FOOTER_LINKS = {
  tools: [
    { href: '/', label: 'Extract', icon: Zap },
    { href: '/directory', label: 'Directory', icon: FolderOpen },
    { href: '/batch', label: 'Batch Processing', icon: Layers },
    { href: '/generator', label: 'llms.txt Generator', icon: FileEdit },
    { href: '/install-generator', label: 'install.md Generator', icon: Terminal },
  ],
  resources: [
    { href: '/docs/', label: 'Documentation', icon: BookOpen },
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/#features', label: 'Features' },
    { href: 'https://llmstxt.org', label: 'llms.txt Standard', external: true },
    { href: '/llms.txt', label: 'Our llms.txt', external: true },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold text-white">
                llm.energy
              </span>
            </Link>
            <p className="text-neutral-500 text-sm max-w-md mb-6">
              Extract llms.txt and install.md files, converting them into organized documents ready for AI agents like Claude, ChatGPT, and other assistants.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://github.com/nirholas/lyra-tool-discovery" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-white/5 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 hover:bg-white/10 transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5 text-neutral-400 hover:text-white" />
              </a>
              <a 
                href="https://x.com/nichxbt" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-white/5 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 hover:bg-white/10 transition-colors text-sm"
              >
                @nichxbt
              </a>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h3 className="text-white font-semibold mb-4">Tools</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.tools.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.icon && <link.icon className="w-4 h-4" />}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a 
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link 
                      href={link.href}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            © {new Date().getFullYear()} llm.energy — Created by{' '}
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
