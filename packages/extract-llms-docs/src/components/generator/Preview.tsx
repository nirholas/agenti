'use client'

import { useMemo, useState } from 'react'
import { Copy, Check, Download, FileText, Hash } from 'lucide-react'
import type { GeneratorData } from '@/types'

interface PreviewProps {
  data: GeneratorData
}

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

/**
 * Estimate token count (roughly 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export default function Preview({ data }: PreviewProps) {
  const [copied, setCopied] = useState(false)

  const content = useMemo(() => generateLlmsTxt(data), [data])
  const tokens = useMemo(() => estimateTokens(content), [content])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = () => {
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
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {content.length.toLocaleString()} chars
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-4 h-4" />
            ~{tokens.toLocaleString()} tokens
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/5 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="px-4 py-2 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-sm font-mono text-neutral-400">llms.txt</span>
          <span className="text-xs text-neutral-500">Preview</span>
        </div>
        
        <div className="p-4 bg-black max-h-96 overflow-y-auto">
          <pre className="text-sm text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
            {content || '# Your site name will appear here\n\nAdd some sections to see the preview...'}
          </pre>
        </div>
      </div>

      {/* Tips */}
      <div className="p-4 bg-white/5 border border-neutral-700 rounded-xl">
        <h4 className="text-sm font-medium text-white mb-2">How to use your llms.txt</h4>
        <ul className="text-xs text-neutral-400 space-y-1">
          <li>1. Download the file and rename it to <code className="px-1 py-0.5 bg-neutral-800 rounded">llms.txt</code></li>
          <li>2. Place it in the root of your website (e.g., <code className="px-1 py-0.5 bg-neutral-800 rounded">example.com/llms.txt</code>)</li>
          <li>3. For full documentation, also create <code className="px-1 py-0.5 bg-neutral-800 rounded">llms-full.txt</code></li>
          <li>4. AI agents can now discover and read your documentation</li>
        </ul>
      </div>
    </div>
  )
}
