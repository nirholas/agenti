'use client'

import { motion } from 'framer-motion'
import { ArrowRight, FileText, Terminal, Layers, Sparkles } from 'lucide-react'
import Link from 'next/link'

const PRODUCTS = [
  {
    id: 'extract',
    icon: FileText,
    title: 'Extract Docs',
    description: 'Fetch llms.txt and documentation from any site. Auto-detects and organizes content for AI agents.',
    href: '/extract',
    badge: 'Popular',
    badgeColor: 'bg-green-500/20 text-green-300',
    features: ['Auto-detect llms.txt', 'Markdown export', 'ZIP download'],
  },
  {
    id: 'install',
    icon: Terminal,
    title: 'install.md Generator',
    description: 'Generate LLM-executable installation instructions from any GitHub repo or docs URL using AI.',
    href: '/install-generator',
    badge: 'New',
    badgeColor: 'bg-blue-500/20 text-blue-300',
    features: ['From GitHub', 'From any URL', 'AI-powered'],
  },
  {
    id: 'batch',
    icon: Layers,
    title: 'Batch Extract',
    description: 'Extract documentation from multiple URLs at once. Process entire doc ecosystems in parallel.',
    href: '/batch',
    badge: null,
    badgeColor: '',
    features: ['Multiple URLs', 'Parallel processing', 'Bulk download'],
  },
  {
    id: 'generator',
    icon: Sparkles,
    title: 'llms.txt Generator',
    description: 'Create your own llms.txt file from scratch. Define sections, add content, and export.',
    href: '/generator',
    badge: null,
    badgeColor: '',
    features: ['Visual editor', 'Live preview', 'Standard format'],
  },
]

export default function ProductCards() {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-white mb-4"
        >
          Tools for AI-Ready Documentation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-neutral-400 max-w-2xl mx-auto"
        >
          Everything you need to extract, generate, and manage documentation for AI agents
        </motion.p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {PRODUCTS.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              href={product.href}
              className="group block h-full rounded-xl border border-neutral-800 p-6 bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-600 hover:bg-neutral-900/80 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-neutral-800 flex items-center justify-center group-hover:border-neutral-600 group-hover:bg-white/10 transition-all">
                  <product.icon className="w-6 h-6 text-white" />
                </div>
                {product.badge && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${product.badgeColor}`}>
                    {product.badge}
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-white transition-colors flex items-center gap-2">
                {product.title}
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              
              <p className="text-neutral-400 text-sm mb-4 leading-relaxed">
                {product.description}
              </p>
              
              <div className="flex flex-wrap gap-2">
                {product.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-1 text-xs bg-white/5 border border-neutral-800 rounded text-neutral-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
