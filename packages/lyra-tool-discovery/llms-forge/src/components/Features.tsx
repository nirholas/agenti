'use client'

import { motion } from 'framer-motion'
import { 
  Search, Scissors, Bot, Archive, FileText, Download
} from 'lucide-react'

const FEATURES = [
  {
    icon: Search,
    title: 'Smart Extraction',
    description: 'Fetches llms.txt or llms-full.txt from any documentation site.',
  },
  {
    icon: Scissors,
    title: 'Organized Sections',
    description: 'Splits documentation into individual markdown files by section headers.',
  },
  {
    icon: Bot,
    title: 'Agent-Ready Output',
    description: 'Includes AGENT-GUIDE.md with instructions for AI assistants like Claude and ChatGPT.',
  },
  {
    icon: Archive,
    title: 'One-Click Download',
    description: 'Download individual files or everything bundled as a convenient ZIP archive.',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 scroll-mt-24">
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-neutral-800 mb-6"
        >
          <FileText className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-neutral-400">FEATURES</span>
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          Simple & Effective
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-xl text-neutral-400 max-w-2xl mx-auto"
        >
          Everything you need to get documentation ready for AI agents
        </motion.p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="group rounded-xl border border-neutral-800 p-6 bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-700 transition-all card-lift"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-neutral-800 flex items-center justify-center mb-4 group-hover:border-neutral-600 transition-colors">
              <feature.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
