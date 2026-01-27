'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, FileEdit, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { GeneratorWizard } from '@/components/generator'
import type { GeneratorData } from '@/types'

/**
 * Generate llms.txt content from generator data
 */
function generateLlmsTxt(data: GeneratorData): string {
  const lines: string[] = []
  
  // Title
  lines.push(`# ${data.siteName}`)
  lines.push('')
  
  // Description
  if (data.description) {
    lines.push(`> ${data.description}`)
    lines.push('')
  }
  
  // Source URL comment
  if (data.url) {
    lines.push(`<!-- Source: ${data.url} -->`)
    lines.push('')
  }
  
  // Sections
  for (const section of data.sections) {
    if (section.title.trim() || section.content.trim()) {
      lines.push(`## ${section.title || 'Untitled Section'}`)
      lines.push('')
      lines.push(section.content || '')
      lines.push('')
    }
  }
  
  return lines.join('\n').trim()
}

export default function GeneratorPage() {
  const handleComplete = useCallback((data: GeneratorData) => {
    const content = generateLlmsTxt(data)
    const slug = data.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'llms'
    const filename = `${slug}.txt`
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
              <FileEdit className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">llms.txt Generator</h1>
              <p className="text-neutral-400">
                Create your own llms.txt file for AI agent discovery
              </p>
            </div>
          </div>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-4 bg-white/5 border border-neutral-700 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="font-medium text-white mb-1">What is llms.txt?</h2>
              <p className="text-sm text-neutral-400">
                The llms.txt file is a standardized way to provide documentation context to AI agents.
                By placing an llms.txt file at the root of your website, AI tools can automatically
                discover and understand your documentation, leading to better assistance for your users.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Generator Wizard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <GeneratorWizard onComplete={handleComplete} />
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}
